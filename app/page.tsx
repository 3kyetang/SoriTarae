"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  FileText,
  Headphones,
  History,
  LockKeyhole,
  LogIn,
  LogOut,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createClient as createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  DiaryEntry,
  DiaryRow,
  DiaryStyle,
  diaryEntryToRow,
  diaryRowToEntry,
} from "@/lib/diaries";

type Screen =
  | "idle"
  | "recording"
  | "processing"
  | "result"
  | "editing"
  | "error";
type Tab = "record" | "history" | "ask" | "settings";
type GeneratedDiaryStyle = Exclude<DiaryStyle, "manual">;
type EmbeddingSyncState = "idle" | "syncing" | "ready" | "error";
type SaveDiaryResult = "failed" | "saved" | "saved-without-embedding";
type RagRequestState = "idle" | "loading" | "success" | "error";

type RagSource = {
  sourceNumber: number;
  diaryId: string;
  title: string;
  createdAt: string;
  similarity: number | null;
  retrievalMethod: "semantic" | "recent" | "both";
};

type RagAnswer = {
  answer: string;
  grounded: boolean;
  sources: RagSource[];
  model: string | null;
};

type AppError = {
  title: string;
  message: string;
  tip: string;
  kind: "audio" | "permission" | "connection" | "general";
};

const STYLE_OPTIONS: Array<{
  value: GeneratedDiaryStyle;
  label: string;
  short: string;
  description: string;
}> = [
  {
    value: "basic",
    label: "기본형",
    short: "자연스러운 일기",
    description: "하루의 흐름과 감정을 차분하게 정리해요.",
  },
  {
    value: "focus",
    label: "핵심 요약",
    short: "중요한 순간 중심",
    description: "꼭 기억하고 싶은 장면을 중심으로 정리해요.",
  },
];

const MANUAL_STYLE_OPTION = {
  value: "manual" as const,
  label: "직접 작성",
  short: "내가 직접 쓴 일기",
  description: "AI의 편집 없이 작성한 내용을 그대로 보관해요.",
};

function getStyleOption(style: DiaryStyle) {
  if (style === "manual") return MANUAL_STYLE_OPTION;
  return (
    STYLE_OPTIONS.find((option) => option.value === style) ?? STYLE_OPTIONS[0]
  );
}

const RAG_QUESTION_SUGGESTIONS = [
  "최근에 했던 일이 뭐야?",
  "요즘 나는 어떤 감정을 자주 느꼈어?",
  "힘들었던 순간에는 무엇이 도움이 됐어?",
] as const;

function isRagSource(value: unknown): value is RagSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Partial<RagSource>;
  return (
    typeof source.sourceNumber === "number" &&
    typeof source.diaryId === "string" &&
    typeof source.title === "string" &&
    typeof source.createdAt === "string" &&
    (typeof source.similarity === "number" || source.similarity === null) &&
    (source.retrievalMethod === "semantic" ||
      source.retrievalMethod === "recent" ||
      source.retrievalMethod === "both")
  );
}

function isRagAnswer(value: unknown): value is RagAnswer {
  if (typeof value !== "object" || value === null) return false;
  const answer = value as Partial<RagAnswer>;
  return (
    typeof answer.answer === "string" &&
    typeof answer.grounded === "boolean" &&
    Array.isArray(answer.sources) &&
    answer.sources.every(isRagSource) &&
    (typeof answer.model === "string" || answer.model === null)
  );
}

function ragApiErrorMessage(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const response = value as {
    error?: {
      message?: unknown;
    };
  };
  return typeof response.error?.message === "string"
    ? response.error.message
    : null;
}

const SUPPORTED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/aiff",
  "audio/x-aiff",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/m4a",
  mp4: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
};

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const HISTORY_KEY = "soritarae.entries.v1";
const LEGACY_HISTORY_KEY = "voicelog.entries.v1";
const EDIT_DRAFT_KEY = "soritarae.edit-draft.v1";
const DIARY_SELECT_FIELDS =
  "id,user_id,title,body,mood,keywords,style,transcript_summary,created_at,updated_at";

function parseLocalDiaryEntries(raw: string | null): DiaryEntry[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value) => {
      if (
        typeof value !== "object" ||
        value === null ||
        !("id" in value) ||
        !("createdAt" in value) ||
        !("title" in value) ||
        !("body" in value) ||
        typeof value.id !== "string" ||
        typeof value.createdAt !== "string" ||
        typeof value.title !== "string" ||
        typeof value.body !== "string"
      ) {
        return [];
      }

      const entry = value as Partial<DiaryEntry>;
      const entryStyle: DiaryStyle =
        entry.style === "basic" || entry.style === "manual"
          ? entry.style
          : "focus";

      return [
        {
          id: value.id,
          createdAt: value.createdAt,
          title: value.title,
          body: value.body,
          mood: typeof entry.mood === "string" ? entry.mood : "",
          keywords: Array.isArray(entry.keywords)
            ? entry.keywords.filter(
                (keyword): keyword is string => typeof keyword === "string",
              )
            : [],
          style: entryStyle,
          transcriptSummary:
            typeof entry.transcriptSummary === "string"
              ? entry.transcriptSummary
              : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

function readLocalDiaryEntries() {
  return parseLocalDiaryEntries(
    window.localStorage.getItem(HISTORY_KEY) ??
      window.localStorage.getItem(LEGACY_HISTORY_KEY),
  );
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      {[10, 18, 28, 18, 10].map((height, index) => (
        <span key={index} style={{ height }} />
      ))}
    </span>
  );
}

function Waveform({
  levels,
  active = false,
  compact = false,
}: {
  levels: number[];
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`waveform ${active ? "is-active" : ""} ${
        compact ? "is-compact" : ""
      }`}
      aria-hidden="true"
    >
      {levels.map((level, index) => (
        <span
          key={index}
          style={{
            height: `${Math.max(compact ? 6 : 10, level * (compact ? 25 : 72))}px`,
          }}
        />
      ))}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatFullDate(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

function formatShortDate(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeMime(file: File) {
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return file;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const inferredType = MIME_BY_EXTENSION[extension];
  if (!inferredType) return file;
  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
}

function mergeAudioChunks(chunks: Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const samples = mergeAudioChunks(chunks);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

const DEFAULT_LEVELS = [
  0.18, 0.34, 0.48, 0.3, 0.66, 0.46, 0.82, 0.55, 0.94, 0.64, 0.76, 0.42,
  0.58, 0.33, 0.46, 0.25, 0.37, 0.2,
];

export default function SoriTaraeApp() {
  const supabaseConfigured = isSupabaseConfigured();
  const [tab, setTab] = useState<Tab>("record");
  const [screen, setScreen] = useState<Screen>("idle");
  const [style, setStyle] = useState<GeneratedDiaryStyle>("basic");
  const [waveLevels, setWaveLevels] = useState(DEFAULT_LEVELS);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isMicStarting, setIsMicStarting] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(8);
  const [currentDiary, setCurrentDiary] = useState<DiaryEntry | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [initialDraft, setInitialDraft] = useState("");
  const [editHistory, setEditHistory] = useState<string[]>([""]);
  const [editIndex, setEditIndex] = useState(0);
  const [manualEntry, setManualEntry] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [connectionReady, setConnectionReady] = useState<boolean | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [entriesReady, setEntriesReady] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isSavingDiary, setIsSavingDiary] = useState(false);
  const [localEntriesToMigrate, setLocalEntriesToMigrate] = useState<
    DiaryEntry[]
  >([]);
  const [isMigratingHistory, setIsMigratingHistory] = useState(false);
  const [migrationError, setMigrationError] = useState("");
  const [migrationNoticeDismissed, setMigrationNoticeDismissed] =
    useState(false);
  const [embeddingSyncState, setEmbeddingSyncState] =
    useState<EmbeddingSyncState>("idle");
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragRequestState, setRagRequestState] =
    useState<RagRequestState>("idle");
  const [ragAnswer, setRagAnswer] = useState<RagAnswer | null>(null);
  const [ragError, setRagError] = useState("");
  const [deletingEntryIds, setDeletingEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  const supabase = useMemo(
    () => (supabaseConfigured ? createSupabaseClient() : null),
    [supabaseConfigured],
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44100);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const historyHydratedRef = useRef(false);
  const embeddingSyncAttemptedForUserRef = useRef<string | null>(null);
  const ragRequestAbortRef = useRef<AbortController | null>(null);

  const selectedStyle = useMemo(
    () => STYLE_OPTIONS.find((option) => option.value === style)!,
    [style],
  );

  const processingMessage =
    processingProgress < 34
      ? "목소리의 흐름을 읽고 있어요"
      : processingProgress < 68
        ? "중요한 순간을 골라내고 있어요"
        : "선택한 스타일로 일기를 다듬고 있어요";

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const requestDiaryEmbedding = useCallback(async (diaryId: string) => {
    try {
      const response = await fetch(
        `/api/diaries/${encodeURIComponent(diaryId)}/embedding`,
        {
          method: "POST",
          cache: "no-store",
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const synchronizeAllDiaryEmbeddings = useCallback(async () => {
    if (!authUserId) return false;

    setEmbeddingSyncState("syncing");
    try {
      for (let requestIndex = 0; requestIndex < 4; requestIndex += 1) {
        const response = await fetch("/api/diaries/embeddings", {
          method: "POST",
          cache: "no-store",
        });
        if (!response.ok) {
          setEmbeddingSyncState("error");
          return false;
        }

        const result = (await response.json()) as { remaining?: number };
        if (!result.remaining) {
          setEmbeddingSyncState("ready");
          return true;
        }
      }
    } catch {
      setEmbeddingSyncState("error");
      return false;
    }

    setEmbeddingSyncState("error");
    return false;
  }, [authUserId]);

  const askDiaryQuestion = useCallback(async () => {
    const question = ragQuestion.trim();
    if (!authUserId) {
      setRagRequestState("error");
      setRagError("내 일기에 질문하려면 먼저 로그인해 주세요.");
      return;
    }
    if (question.length < 2) {
      setRagRequestState("error");
      setRagError("질문을 두 글자 이상 입력해 주세요.");
      return;
    }

    ragRequestAbortRef.current?.abort();
    const controller = new AbortController();
    ragRequestAbortRef.current = controller;
    setRagRequestState("loading");
    setRagAnswer(null);
    setRagError("");

    try {
      const response = await fetch("/api/rag/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          ragApiErrorMessage(payload) ??
            "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      if (!isRagAnswer(payload)) {
        throw new Error("답변 형식을 확인할 수 없습니다. 다시 시도해 주세요.");
      }

      setRagAnswer(payload);
      setRagRequestState("success");
    } catch (error) {
      if (controller.signal.aborted) return;
      setRagRequestState("error");
      setRagError(
        error instanceof Error
          ? error.message
          : "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      if (ragRequestAbortRef.current === controller) {
        ragRequestAbortRef.current = null;
      }
    }
  }, [authUserId, ragQuestion]);

  const handleSignOut = useCallback(async () => {
    if (!supabase || isSigningOut) return;

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (error) {
      showToast("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setAuthEmail(null);
    setAuthUserId(null);
    window.location.assign("/");
  }, [isSigningOut, showToast, supabase]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setAuthEmail(data.user?.email ?? null);
      setAuthUserId(data.user?.id ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthEmail(session?.user.email ?? null);
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(
    () => () => {
      ragRequestAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) =>
        setConnectionReady(Boolean(data.configured)),
      )
      .catch(() => setConnectionReady(false));

  }, []);

  useEffect(() => {
    if (!authReady) return;

    let isActive = true;
    const hydrationTimer = window.setTimeout(() => {
      if (!isActive) return;
      historyHydratedRef.current = false;
      setEntriesReady(false);
      setHistoryError("");

      if (authUserId && supabase) {
        setLocalEntriesToMigrate(readLocalDiaryEntries());
        supabase
          .from("diaries")
          .select(DIARY_SELECT_FIELDS)
          .order("created_at", { ascending: false })
          .then(({ data, error }) => {
            if (!isActive) return;
            if (error) {
              setEntries([]);
              setHistoryError(
                "클라우드 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
              );
            } else {
              setEntries(((data ?? []) as DiaryRow[]).map(diaryRowToEntry));
            }
            setEntriesReady(true);
          });
        return;
      }

      const savedEntries = readLocalDiaryEntries();

      historyHydratedRef.current = true;
      setLocalEntriesToMigrate([]);
      setEntries(savedEntries);
      setEntriesReady(true);
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(hydrationTimer);
    };
  }, [authReady, authUserId, supabase]);

  useEffect(() => {
    if (!authUserId) {
      embeddingSyncAttemptedForUserRef.current = null;
      return;
    }
    if (
      !entriesReady ||
      historyError ||
      embeddingSyncAttemptedForUserRef.current === authUserId
    ) {
      return;
    }

    embeddingSyncAttemptedForUserRef.current = authUserId;
    void synchronizeAllDiaryEmbeddings();
  }, [
    authUserId,
    entriesReady,
    historyError,
    synchronizeAllDiaryEmbeddings,
  ]);

  useEffect(() => {
    if (!authReady || authUserId || !historyHydratedRef.current) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
      window.localStorage.removeItem(LEGACY_HISTORY_KEY);
    } catch {
      // Local history is best-effort device storage.
    }
  }, [authReady, authUserId, entries]);

  useEffect(() => {
    if (screen !== "editing") return;
    try {
      window.localStorage.setItem(
        EDIT_DRAFT_KEY,
        JSON.stringify({ title: editTitle, body: editBody }),
      );
    } catch {
      // Best-effort autosave only.
    }
  }, [editBody, editTitle, screen]);

  useEffect(() => {
    if (screen !== "processing") return;
    const progressTimer = window.setInterval(() => {
      setProcessingProgress((value) => {
        if (value >= 92) return value;
        return Math.min(92, value + Math.max(1, Math.round((95 - value) / 13)));
      });
    }, 700);
    return () => window.clearInterval(progressTimer);
  }, [screen]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [screen, tab]);

  const releaseRecorder = useCallback(async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    if (processorRef.current) processorRef.current.onaudioprocess = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());

    if (audioContextRef.current?.state !== "closed") {
      await audioContextRef.current?.close().catch(() => undefined);
    }

    streamRef.current = null;
    audioContextRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    processorRef.current = null;
    silentGainRef.current = null;
    setWaveLevels(DEFAULT_LEVELS);
  }, []);

  useEffect(
    () => () => {
      requestAbortRef.current?.abort();
      void releaseRecorder();
    },
    [releaseRecorder],
  );

  const switchTab = (nextTab: Tab) => {
    if (screen === "recording" || screen === "processing") {
      showToast("진행 중인 작업을 먼저 마쳐 주세요.");
      return;
    }
    setTab(nextTab);
    if (nextTab === "record") setScreen("idle");
  };

  const generateDiary = useCallback(
    async (blob: Blob, selected: GeneratedDiaryStyle) => {
      setAudioBlob(blob);
      setAppError(null);
      setProcessingProgress(8);
      setScreen("processing");

      const controller = new AbortController();
      requestAbortRef.current = controller;

      const filename =
        blob instanceof File && blob.name ? blob.name : "soritarae-recording.wav";
      const file =
        blob instanceof File
          ? blob
          : new File([blob], filename, { type: blob.type || "audio/wav" });
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("style", selected);

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          diary?: {
            title?: string;
            body?: string;
            mood?: string;
            keywords?: string[];
            transcriptSummary?: string;
          };
          error?: { code?: string; message?: string } | string;
        };

        if (!response.ok || !payload.diary) {
          const code =
            typeof payload.error === "object" ? payload.error.code : undefined;
          const upstreamMessage =
            typeof payload.error === "object"
              ? payload.error.message
              : typeof payload.error === "string"
                ? payload.error
                : "";

          if (code === "CONFIG_MISSING" || response.status === 503) {
            setAppError({
              title: "AI 연결 준비가 필요해요",
              message:
                "녹음은 잘 완료됐지만 아직 일기 생성 연결이 준비되지 않았어요.",
              tip: "연결이 완료된 뒤 다시 시도하거나, 지금은 직접 텍스트로 기록할 수 있어요.",
              kind: "connection",
            });
          } else {
            setAppError({
              title: "음성을 일기로 바꾸지 못했어요",
              message:
                upstreamMessage ||
                "음성이 너무 짧거나 주변 소음이 커서 내용을 충분히 이해하지 못했어요.",
              tip: "조용한 곳에서 5초 이상 말하거나, 지원되는 오디오 파일을 올려 주세요.",
              kind: "audio",
            });
          }
          setScreen("error");
          return;
        }

        const now = new Date();
        const diary: DiaryEntry = {
          id: crypto.randomUUID(),
          createdAt: now.toISOString(),
          title: payload.diary.title?.trim() || "오늘의 기록",
          body: payload.diary.body?.trim() || "",
          mood: payload.diary.mood?.trim() || "차분함",
          keywords: Array.isArray(payload.diary.keywords)
            ? payload.diary.keywords.slice(0, 5)
            : [],
          style: selected,
          transcriptSummary: payload.diary.transcriptSummary?.trim() || "",
        };

        setProcessingProgress(100);
        setCurrentDiary(diary);
        window.setTimeout(() => setScreen("result"), 280);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAppError({
          title: "연결이 잠시 불안정해요",
          message: "일기 생성 중 연결이 끊겼어요. 녹음은 이 화면에 남아 있어요.",
          tip: "네트워크를 확인한 뒤 다시 생성을 눌러 주세요.",
          kind: "connection",
        });
        setScreen("error");
      } finally {
        requestAbortRef.current = null;
      }
    },
    [],
  );

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAppError({
        title: "이 브라우저에서는 녹음할 수 없어요",
        message: "마이크 녹음을 지원하지 않는 환경이에요.",
        tip: "대신 WAV, MP3, M4A, AAC, OGG 또는 FLAC 파일을 올려 주세요.",
        kind: "permission",
      });
      setScreen("error");
      return;
    }

    setIsMicStarting(true);
    setAppError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const WindowWithWebkit = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextConstructor =
        window.AudioContext || WindowWithWebkit.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("AudioContext unavailable");

      const context = new AudioContextConstructor();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      audioChunksRef.current = [];
      sampleRateRef.current = context.sampleRate;
      processor.onaudioprocess = (event) => {
        audioChunksRef.current.push(
          new Float32Array(event.inputBuffer.getChannelData(0)),
        );
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      streamRef.current = stream;
      audioContextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setScreen("recording");

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(
          Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        );
      }, 250);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteTimeDomainData(data);
        const next = Array.from({ length: 18 }, (_, index) => {
          const dataIndex = Math.floor((index / 18) * data.length);
          const amplitude = Math.abs(data[dataIndex] - 128) / 68;
          return Math.min(1, Math.max(0.12, amplitude * 2.2));
        });
        setWaveLevels(next);
        animationFrameRef.current = window.requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const permissionDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setAppError({
        title: permissionDenied
          ? "마이크 권한이 필요해요"
          : "녹음을 시작하지 못했어요",
        message: permissionDenied
          ? "브라우저에서 SoriTarae의 마이크 사용을 허용해 주세요."
          : "현재 기기의 녹음 장치를 연결하지 못했어요.",
        tip: "권한을 허용한 뒤 다시 시도하거나, 오디오 파일 업로드를 이용해 주세요.",
        kind: "permission",
      });
      setScreen("error");
    } finally {
      setIsMicStarting(false);
    }
  };

  const stopRecording = async () => {
    const duration = Math.max(
      recordingSeconds,
      Math.floor((Date.now() - startedAtRef.current) / 1000),
    );
    const chunks = [...audioChunksRef.current];
    const sampleRate = sampleRateRef.current;
    await releaseRecorder();

    if (duration < 3 || chunks.length === 0) {
      setAppError({
        title: "녹음 내용이 조금 짧아요",
        message: "일기로 정리할 만큼 충분한 목소리를 듣지 못했어요.",
        tip: "5초 이상 편하게 이야기해 주세요. 중간에 쉬어도 녹음은 계속됩니다.",
        kind: "audio",
      });
      setScreen("error");
      return;
    }

    const wav = encodeWav(chunks, sampleRate);
    if (wav.size > MAX_AUDIO_BYTES) {
      setAppError({
        title: "녹음 파일이 너무 커요",
        message: "한 번에 처리할 수 있는 녹음 크기를 넘었어요.",
        tip: "조금 더 짧게 나누어 녹음하거나 4MB 이하 파일을 올려 주세요.",
        kind: "audio",
      });
      setScreen("error");
      return;
    }

    await generateDiary(wav, style);
  };

  const cancelRecording = async () => {
    await releaseRecorder();
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setScreen("idle");
  };

  const cancelProcessing = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setProcessingProgress(8);
    setScreen("idle");
    showToast("일기 만들기를 취소했어요.");
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const sourceFile = event.target.files?.[0];
    event.target.value = "";
    if (!sourceFile) return;
    const file = normalizeMime(sourceFile);

    if (!SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) {
      setAppError({
        title: "지원하지 않는 파일 형식이에요",
        message: "이 오디오 형식은 아직 바로 처리할 수 없어요.",
        tip: "WAV, MP3, M4A, AAC, OGG, FLAC 또는 AIFF 파일을 올려 주세요.",
        kind: "audio",
      });
      setScreen("error");
      return;
    }

    if (file.size > MAX_AUDIO_BYTES) {
      setAppError({
        title: "파일 크기가 너무 커요",
        message: "오디오 파일은 4MB까지 올릴 수 있어요.",
        tip: "파일을 짧게 나누거나 압축한 뒤 다시 시도해 주세요.",
        kind: "audio",
      });
      setScreen("error");
      return;
    }

    if (file.size < 4096) {
      setAppError({
        title: "오디오 내용이 너무 짧아요",
        message: "파일에서 충분한 음성 데이터를 찾지 못했어요.",
        tip: "5초 이상의 음성이 담긴 파일을 선택해 주세요.",
        kind: "audio",
      });
      setScreen("error");
      return;
    }

    await generateDiary(file, style);
  };

  const startManualEntry = () => {
    setManualEntry(true);
    setCurrentDiary(null);
    setEditTitle("오늘의 기록");
    setEditBody("");
    setInitialDraft("");
    setEditHistory([""]);
    setEditIndex(0);
    setScreen("editing");
  };

  const startEditing = () => {
    if (!currentDiary) return;
    setManualEntry(false);
    setEditTitle(currentDiary.title);
    setEditBody(currentDiary.body);
    setInitialDraft(currentDiary.body);
    setEditHistory([currentDiary.body]);
    setEditIndex(0);
    setScreen("editing");
  };

  const updateEditBody = (value: string) => {
    const limited = value.slice(0, 1000);
    setEditBody(limited);
    const nextHistory = [
      ...editHistory.slice(0, editIndex + 1),
      limited,
    ].slice(-60);
    setEditHistory(nextHistory);
    setEditIndex(nextHistory.length - 1);
  };

  const undoEdit = () => {
    if (editIndex <= 0) return;
    const nextIndex = editIndex - 1;
    setEditIndex(nextIndex);
    setEditBody(editHistory[nextIndex]);
  };

  const redoEdit = () => {
    if (editIndex >= editHistory.length - 1) return;
    const nextIndex = editIndex + 1;
    setEditIndex(nextIndex);
    setEditBody(editHistory[nextIndex]);
  };

  const restoreDraft = () => {
    updateEditBody(initialDraft);
    showToast(manualEntry ? "작성 내용을 비웠어요." : "AI 초안으로 복원했어요.");
  };

  const finishEditing = () => {
    if (editBody.trim().length < 5) {
      showToast("조금만 더 내용을 적어 주세요.");
      return;
    }

    const next: DiaryEntry = currentDiary
      ? {
          ...currentDiary,
          title: editTitle.trim() || "오늘의 기록",
          body: editBody.trim(),
        }
      : {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          title: editTitle.trim() || "오늘의 기록",
          body: editBody.trim(),
          mood: "차분함",
          keywords: [],
          style: "manual",
          transcriptSummary: "",
        };
    setCurrentDiary(next);
    setScreen("result");
    try {
      window.localStorage.removeItem(EDIT_DRAFT_KEY);
    } catch {
      // Best-effort cleanup.
    }
  };

  const saveCurrent = useCallback(async (): Promise<SaveDiaryResult> => {
    if (!currentDiary || isSavingDiary) return "failed";

    if (authUserId && supabase) {
      setIsSavingDiary(true);
      try {
        const { data, error } = await supabase
          .from("diaries")
          .upsert(diaryEntryToRow(currentDiary, authUserId), {
            onConflict: "id",
          })
          .select(
            DIARY_SELECT_FIELDS,
          )
          .single();

        if (error || !data) {
          showToast("클라우드에 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
          return "failed";
        }

        const savedEntry = diaryRowToEntry(data as DiaryRow);
        setCurrentDiary(savedEntry);
        setEntries((previous) => [
          savedEntry,
          ...previous.filter((entry) => entry.id !== savedEntry.id),
        ]);
        const embeddingReady = await requestDiaryEmbedding(savedEntry.id);
        setEmbeddingSyncState(embeddingReady ? "ready" : "error");
        return embeddingReady ? "saved" : "saved-without-embedding";
      } finally {
        setIsSavingDiary(false);
      }
    }

    setEntries((previous) => [
      currentDiary,
      ...previous.filter((entry) => entry.id !== currentDiary.id),
    ]);
    return "saved";
  }, [
    authUserId,
    currentDiary,
    isSavingDiary,
    requestDiaryEmbedding,
    showToast,
    supabase,
  ]);

  const openExport = async () => {
    if (!currentDiary) return;
    const saveResult = await saveCurrent();
    if (saveResult === "failed") return;
    setExportOpen(true);
    showToast(
      saveResult === "saved-without-embedding"
        ? "일기는 저장됐지만 검색 준비는 나중에 다시 시도해 주세요."
        : authUserId
          ? "내 클라우드 기록에 저장했어요."
          : "이 기기의 기록에 저장했어요.",
    );
  };

  const diaryAsText = useCallback(() => {
    if (!currentDiary) return "";
    const keywords = currentDiary.keywords.length
      ? `\n#${currentDiary.keywords.join(" #")}`
      : "";
    return `${currentDiary.title}\n${formatFullDate(currentDiary.createdAt)}\n\n${currentDiary.body}${keywords}\n\n— SoriTarae`;
  }, [currentDiary]);

  const downloadDiary = () => {
    if (!currentDiary) return;
    const blob = new Blob([diaryAsText()], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `SoriTarae_${currentDiary.createdAt.slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("텍스트 파일로 내보냈어요.");
  };

  const copyDiary = async () => {
    await navigator.clipboard.writeText(diaryAsText());
    showToast("일기를 클립보드에 복사했어요.");
  };

  const shareDiary = async () => {
    if (!currentDiary) return;
    if (navigator.share) {
      await navigator
        .share({
          title: currentDiary.title,
          text: diaryAsText(),
        })
        .catch(() => undefined);
      return;
    }
    await copyDiary();
  };

  const regenerate = async () => {
    if (!audioBlob) {
      showToast("이 기록에는 다시 사용할 음성이 남아 있지 않아요.");
      return;
    }
    await generateDiary(audioBlob, style);
  };

  const openHistoryEntry = (entry: DiaryEntry) => {
    setCurrentDiary(entry);
    if (entry.style !== "manual") setStyle(entry.style);
    setAudioBlob(null);
    setTab("record");
    setScreen("result");
  };

  const openRagSource = (source: RagSource) => {
    const entry = entries.find((candidate) => candidate.id === source.diaryId);
    if (entry) {
      openHistoryEntry(entry);
      return;
    }

    setTab("history");
    showToast("참고한 일기를 기록 목록에서 확인해 주세요.");
  };

  const submitRagQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askDiaryQuestion();
  };

  const migrateLocalHistory = async () => {
    if (
      !authUserId ||
      !supabase ||
      !localEntriesToMigrate.length ||
      isMigratingHistory
    ) {
      return;
    }

    setIsMigratingHistory(true);
    setMigrationError("");

    const rows = localEntriesToMigrate.map((entry) =>
      diaryEntryToRow(entry, authUserId),
    );
    const { error: uploadError } = await supabase
      .from("diaries")
      .upsert(rows, {
        onConflict: "id",
        ignoreDuplicates: true,
      });

    if (uploadError) {
      setIsMigratingHistory(false);
      setMigrationError(
        "로컬 기록을 업로드하지 못했어요. 원본은 이 기기에 그대로 남아 있어요.",
      );
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("diaries")
      .select(DIARY_SELECT_FIELDS)
      .order("created_at", { ascending: false });

    const refreshedEntries = ((data ?? []) as DiaryRow[]).map(diaryRowToEntry);
    const refreshedIds = new Set(refreshedEntries.map((entry) => entry.id));
    const allMigrated =
      !refreshError &&
      localEntriesToMigrate.every((entry) => refreshedIds.has(entry.id));

    if (!allMigrated) {
      setIsMigratingHistory(false);
      setMigrationError(
        "일부 기록을 확인하지 못해 로컬 원본을 유지했어요. 다시 시도해 주세요.",
      );
      return;
    }

    try {
      window.localStorage.removeItem(HISTORY_KEY);
      window.localStorage.removeItem(LEGACY_HISTORY_KEY);
    } catch {
      setIsMigratingHistory(false);
      setEntries(refreshedEntries);
      setMigrationError(
        "클라우드 저장은 완료됐지만 이 기기의 사본을 정리하지 못했어요.",
      );
      return;
    }

    const migratedCount = localEntriesToMigrate.length;
    setEntries(refreshedEntries);
    setLocalEntriesToMigrate([]);
    setIsMigratingHistory(false);
    void synchronizeAllDiaryEmbeddings();
    showToast(`로컬 기록 ${migratedCount}개를 클라우드로 가져왔어요.`);
  };

  const deleteEntry = async (id: string) => {
    if (deletingEntryIds.has(id)) return;

    if (authUserId && supabase) {
      setDeletingEntryIds((previous) => new Set(previous).add(id));
      const { error } = await supabase
        .from("diaries")
        .delete()
        .eq("id", id)
        .eq("user_id", authUserId);
      setDeletingEntryIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });

      if (error) {
        showToast("클라우드 기록을 삭제하지 못했어요.");
        return;
      }
    }

    setEntries((previous) => previous.filter((entry) => entry.id !== id));
    showToast("기록을 삭제했어요.");
  };

  const clearHistory = async () => {
    if (!entries.length) return;
    const storageLabel = authUserId ? "클라우드" : "이 기기";
    if (
      !window.confirm(
        `${storageLabel}에 저장된 모든 일기를 삭제할까요? 이 작업은 되돌릴 수 없어요.`,
      )
    ) {
      return;
    }

    if (authUserId && supabase) {
      const { error } = await supabase
        .from("diaries")
        .delete()
        .eq("user_id", authUserId);
      if (error) {
        showToast("클라우드 기록을 삭제하지 못했어요.");
        return;
      }
    }

    setEntries([]);
    showToast("저장된 기록을 모두 삭제했어요.");
  };

  const renderIdle = () => (
    <div className="record-layout">
      <section className="intro-column" aria-labelledby="record-title">
        <span className="eyebrow">
          <Sparkles size={15} />
          오늘의 기록
        </span>
        <h1 id="record-title">오늘 있었던 일을 들려주세요</h1>
        <p className="lead">
          완벽하게 말하지 않아도 괜찮아요. 편하게 이야기하면 SoriTarae가
          하루의 흐름을 정돈해 일기로 바꿔드려요.
        </p>

        <fieldset className="style-fieldset">
          <legend>일기 스타일</legend>
          <div className="style-options">
            {STYLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`style-option ${
                  style === option.value ? "is-selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="diary-style"
                  value={option.value}
                  checked={style === option.value}
                  onChange={() => setStyle(option.value)}
                />
                <span className="style-check" aria-hidden="true">
                  {style === option.value && <Check size={14} strokeWidth={3} />}
                </span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.short}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="reassurance-note">
          <ShieldCheck size={20} />
          <p>
            <strong>쉬어 가며 말해도 괜찮아요.</strong>
            <span>정지하기 전까지 긴 공백이 생겨도 녹음은 계속돼요.</span>
          </p>
        </div>
      </section>

      <section className="recorder-card" aria-label="음성 입력">
        <div className="recorder-ambient ambient-one" />
        <div className="recorder-ambient ambient-two" />
        <div className="recorder-card-top">
          <span className="tiny-label">선택한 스타일</span>
          <span className="selected-style-badge">
            <Check size={14} />
            {selectedStyle.label}
          </span>
        </div>
        <div className="idle-visual">
          <div className="wave-orb">
            <Waveform levels={DEFAULT_LEVELS} />
          </div>
          <p>마이크를 누르고 오늘의 이야기를 시작해 보세요.</p>
        </div>
        <button
          type="button"
          className="primary-button record-start"
          onClick={startRecording}
          disabled={isMicStarting}
        >
          <Mic size={21} />
          {isMicStarting ? "마이크 연결 중…" : "녹음 시작"}
        </button>
        <div className="divider-label">
          <span />
          또는
          <span />
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={19} />
          오디오 파일 업로드
        </button>
        <button type="button" className="text-button" onClick={startManualEntry}>
          <FileText size={17} />
          음성 없이 직접 작성
        </button>
        <p className="file-hint">
          WAV, MP3, M4A, AAC, OGG, FLAC · 최대 4MB
        </p>
      </section>
    </div>
  );

  const renderRecording = () => (
    <section className="focus-panel recording-panel" aria-labelledby="recording-title">
      <div className="focus-panel-head">
        <button type="button" className="back-button" onClick={cancelRecording}>
          <X size={20} />
          녹음 취소
        </button>
        <span className="live-badge">
          <span />
          녹음 중
        </span>
      </div>
      <div className="recording-copy">
        <span className="eyebrow">{selectedStyle.label}</span>
        <h1 id="recording-title">편하게 이야기하고 있어요</h1>
        <p>중얼거리거나 잠시 쉬어도 괜찮아요. 목소리를 놓치지 않을게요.</p>
      </div>
      <div className="live-wave-orb">
        <Waveform levels={waveLevels} active />
      </div>
      <time className="recording-timer" aria-live="off">
        {formatTimer(recordingSeconds)}
      </time>
      <div className="recording-tip">
        <Headphones size={19} />
        <span>휴대폰과 20cm 정도 거리를 두면 더 또렷하게 들려요.</span>
      </div>
      <button
        type="button"
        className="stop-button"
        onClick={stopRecording}
        aria-label="녹음을 정지하고 일기 만들기"
      >
        <span>
          <Square size={24} fill="currentColor" />
        </span>
        녹음 마치기
      </button>
    </section>
  );

  const renderProcessing = () => (
    <section
      className="focus-panel processing-panel"
      aria-labelledby="processing-title"
      role="status"
      aria-live="polite"
    >
      <div className="processing-visual" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="spark-core">
          <Sparkles size={38} />
        </div>
      </div>
      <span className="eyebrow">AI 일기 작성 중</span>
      <h1 id="processing-title">{processingMessage}</h1>
      <p>
        추임새와 긴 공백은 덜어내고, 말해 준 사실과 감정은 그대로
        지키고 있어요.
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={processingProgress}
      >
        <span style={{ width: `${processingProgress}%` }} />
      </div>
      <div className="privacy-inline">
        <LockKeyhole size={16} />
        일기 생성을 위해 전달된 음성은 별도 보관하지 않도록 요청돼요.
      </div>
      <button
        type="button"
        className="secondary-button processing-cancel"
        onClick={cancelProcessing}
      >
        <X size={18} />
        작업 취소
      </button>
    </section>
  );

  const renderResult = () => {
    if (!currentDiary) return renderIdle();
    const resultStyle = getStyleOption(currentDiary.style);
    return (
      <section className="result-screen" aria-labelledby="result-title">
        <div className="result-hero">
          <div className="completion-mark">
            <Sparkles size={28} />
          </div>
          <div>
            <span className="eyebrow">일기 완성</span>
            <h1 id="result-title">오늘의 이야기를 정리했어요</h1>
            <p>{formatFullDate(currentDiary.createdAt)}</p>
          </div>
        </div>

        <article className="diary-paper">
          <div className="paper-meta">
            <span className="style-chip">
              <BookOpen size={15} />
              {resultStyle.label}
            </span>
            <span className="mood-chip">{currentDiary.mood}</span>
          </div>
          <h2>{currentDiary.title}</h2>
          <div className="diary-body">
            {currentDiary.body.split(/\n+/).map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 12)}-${index}`}>{paragraph}</p>
            ))}
          </div>
          {currentDiary.keywords.length > 0 && (
            <div className="keyword-row" aria-label="일기 키워드">
              {currentDiary.keywords.map((keyword) => (
                <span key={keyword}>#{keyword}</span>
              ))}
            </div>
          )}
        </article>

        <div className="ai-review-note">
          <ShieldCheck size={20} />
          <p>
            <strong>마지막 확인은 직접 해주세요.</strong>
            <span>
              실제 하루의 사실과 감정이 잘 담겼는지 읽어보고 자유롭게
              다듬어 보세요.
            </span>
          </p>
        </div>

        <div className="result-actions">
          <button type="button" className="secondary-button" onClick={startEditing}>
            <Pencil size={18} />
            수정하기
          </button>
          {audioBlob && (
            <button
              type="button"
              className="secondary-button"
              onClick={regenerate}
            >
              <RefreshCw size={18} />
              다시 생성
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={openExport}
            disabled={isSavingDiary}
          >
            <Save size={19} />
            {isSavingDiary ? "저장 중..." : "저장 · 내보내기"}
          </button>
        </div>
      </section>
    );
  };

  const renderEditing = () => (
    <section className="editor-screen" aria-labelledby="editor-title">
      <div className="editor-head">
        <button
          type="button"
          className="back-button"
          onClick={() => setScreen(currentDiary ? "result" : "idle")}
        >
          <ArrowLeft size={20} />
          돌아가기
        </button>
        <div className="undo-controls">
          <IconButton
            label="실행 취소"
            onClick={undoEdit}
            disabled={editIndex <= 0}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="다시 실행"
            onClick={redoEdit}
            disabled={editIndex >= editHistory.length - 1}
          >
            <Redo2 size={18} />
          </IconButton>
        </div>
      </div>
      <span className="eyebrow">{manualEntry ? "직접 작성" : "일기 다듬기"}</span>
      <h1 id="editor-title">
        {manualEntry ? "오늘의 기록을 적어보세요" : "내 이야기답게 다듬어 보세요"}
      </h1>
      <p className="editor-lead">
        최종 기록의 주체는 나예요. 사실과 다른 부분이나 감정 표현을 편하게
        고쳐 주세요.
      </p>

      <label className="editor-title-field">
        <span>제목</span>
        <input
          value={editTitle}
          maxLength={60}
          onChange={(event) => setEditTitle(event.target.value)}
          placeholder="오늘의 기록"
        />
      </label>
      <label className="editor-body-field">
        <span className="sr-only">일기 내용</span>
        <textarea
          value={editBody}
          onChange={(event) => updateEditBody(event.target.value)}
          maxLength={1000}
          autoFocus
          placeholder="오늘 있었던 일과 그때의 마음을 자유롭게 적어보세요."
        />
        <span className="character-count">{editBody.length} / 1000</span>
      </label>
      <div className="autosave-note">
        <CheckCircle2 size={16} />
        편집 중인 초안은 이 기기에 자동 저장돼요.
      </div>
      <div className="editor-actions">
        <button type="button" className="secondary-button" onClick={restoreDraft}>
          <RotateCcw size={18} />
          {manualEntry ? "내용 비우기" : "AI 초안으로 복원"}
        </button>
        <button type="button" className="primary-button" onClick={finishEditing}>
          <Check size={19} />
          수정 완료
        </button>
      </div>
    </section>
  );

  const renderError = () => {
    const error = appError ?? {
      title: "잠시 문제가 생겼어요",
      message: "요청을 마치지 못했어요.",
      tip: "잠시 후 다시 시도해 주세요.",
      kind: "general" as const,
    };
    return (
      <section className="focus-panel error-panel" aria-labelledby="error-title">
        <div className={`error-icon error-${error.kind}`}>
          {error.kind === "connection" ? (
            <WifiOff size={42} />
          ) : (
            <VolumeX size={42} />
          )}
        </div>
        <span className="eyebrow">다시 시도할 수 있어요</span>
        <h1 id="error-title">{error.title}</h1>
        <p>{error.message}</p>
        <div className="error-tip">
          <Headphones size={19} />
          {error.tip}
        </div>
        <div className="error-actions">
          <button
            type="button"
            className="primary-button"
            onClick={startRecording}
          >
            <Mic size={19} />
            다시 녹음하기
          </button>
          {audioBlob && error.kind === "connection" && (
            <button
              type="button"
              className="secondary-button"
              onClick={regenerate}
            >
              <RefreshCw size={18} />
              다시 생성
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            파일 업로드
          </button>
          <button type="button" className="text-button" onClick={startManualEntry}>
            <FileText size={17} />
            직접 텍스트 작성
          </button>
        </div>
        <button type="button" className="subtle-link" onClick={() => setScreen("idle")}>
          메인으로 돌아가기
        </button>
      </section>
    );
  };

  const renderHistory = () => (
    <section className="history-screen" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">나의 기록</span>
          <h1 id="history-title">다시 펼쳐보는 하루</h1>
          <p>
            {authUserId
              ? "로그인한 계정의 클라우드 기록이에요."
              : "로그인하지 않은 기록은 이 기기에만 보관돼요."}
          </p>
        </div>
        <button
          type="button"
          className="primary-button compact-button"
          onClick={() => switchTab("record")}
        >
          <Plus size={18} />
          새 기록
        </button>
      </div>

      {authUserId &&
        entriesReady &&
        !historyError &&
        localEntriesToMigrate.length > 0 &&
        !migrationNoticeDismissed && (
          <aside className="migration-banner" aria-labelledby="migration-title">
            <span className="migration-icon" aria-hidden="true">
              <Upload size={22} />
            </span>
            <div>
              <strong id="migration-title">
                이 기기에 저장된 기록 {localEntriesToMigrate.length}개가 있어요
              </strong>
              <p>
                내 클라우드 기록으로 가져올 수 있어요. 모두 확인되기 전에는
                로컬 원본을 삭제하지 않아요.
              </p>
              {migrationError && (
                <p className="migration-error" role="alert">
                  {migrationError}
                </p>
              )}
            </div>
            <div className="migration-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={migrateLocalHistory}
                disabled={isMigratingHistory}
              >
                {isMigratingHistory ? "가져오는 중..." : "클라우드로 가져오기"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setMigrationNoticeDismissed(true)}
                disabled={isMigratingHistory}
              >
                나중에
              </button>
            </div>
          </aside>
        )}

      {!entriesReady ? (
        <div className="empty-state" role="status">
          <div className="empty-illustration">
            <RefreshCw size={34} />
          </div>
          <h2>기록을 불러오고 있어요</h2>
          <p>잠시만 기다려 주세요.</p>
        </div>
      ) : historyError ? (
        <div className="empty-state" role="alert">
          <div className="empty-illustration">
            <WifiOff size={34} />
          </div>
          <h2>기록을 불러오지 못했어요</h2>
          <p>{historyError}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={18} />
            다시 시도
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <BookOpen size={38} />
          </div>
          <h2>아직 저장한 일기가 없어요</h2>
          <p>오늘의 이야기를 들려주면 첫 번째 기록이 이곳에 쌓여요.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => switchTab("record")}
          >
            <Mic size={18} />
            첫 일기 만들기
          </button>
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => {
            const option = getStyleOption(entry.style);
            return (
              <article key={entry.id} className="history-card">
                <button
                  type="button"
                  className="history-card-main"
                  onClick={() => openHistoryEntry(entry)}
                >
                  <span className="history-date">
                    <strong>{formatShortDate(entry.createdAt)}</strong>
                    <small>
                      {new Intl.DateTimeFormat("ko-KR", {
                        weekday: "short",
                      }).format(new Date(entry.createdAt))}
                    </small>
                  </span>
                  <span className="history-content">
                    <span className="history-meta">
                      <span>{option.label}</span>
                      <span>{entry.mood}</span>
                    </span>
                    <strong>{entry.title}</strong>
                    <span>{entry.body}</span>
                  </span>
                </button>
                <IconButton
                  label={`${entry.title} 삭제`}
                  onClick={() => deleteEntry(entry.id)}
                  disabled={deletingEntryIds.has(entry.id)}
                >
                  <Trash2 size={17} />
                </IconButton>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderAsk = () => (
    <section className="ask-screen" aria-labelledby="ask-title">
      <div className="section-heading ask-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} />
            나의 기록 돌아보기
          </span>
          <h1 id="ask-title">내 일기에 질문해 보세요</h1>
          <p>
            저장한 일기에서 관련 기록을 찾아, 그 내용에 근거해 답해드려요.
          </p>
        </div>
      </div>

      {!authReady ? (
        <div className="ask-gate" role="status">
          <RefreshCw size={30} />
          <strong>로그인 상태를 확인하고 있어요</strong>
        </div>
      ) : !authUserId ? (
        <div className="ask-gate">
          <span className="ask-gate-icon">
            <LockKeyhole size={30} />
          </span>
          <h2>로그인한 기록에서만 질문할 수 있어요</h2>
          <p>
            계정별 일기를 안전하게 구분하기 위해 로그인 후 질문 기능을
            제공해요.
          </p>
          <a className="primary-button" href="/auth/login">
            <LogIn size={18} />
            로그인하기
          </a>
        </div>
      ) : (
        <>
          <form className="question-card" onSubmit={submitRagQuestion}>
            <label htmlFor="rag-question">궁금한 내용을 적어 주세요</label>
            <div className="question-field">
              <textarea
                id="rag-question"
                value={ragQuestion}
                onChange={(event) =>
                  setRagQuestion(event.target.value.slice(0, 500))
                }
                placeholder="예: 최근에 내가 기뻐했던 일은 뭐야?"
                maxLength={500}
                disabled={ragRequestState === "loading"}
              />
              <span>{ragQuestion.length}/500</span>
            </div>
            <div className="question-actions">
              <div className="question-suggestions" aria-label="추천 질문">
                {RAG_QUESTION_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setRagQuestion(suggestion)}
                    disabled={ragRequestState === "loading"}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="primary-button ask-submit"
                disabled={
                  ragRequestState === "loading" ||
                  ragQuestion.trim().length < 2
                }
              >
                {ragRequestState === "loading" ? (
                  <RefreshCw className="is-spinning" size={18} />
                ) : (
                  <Send size={18} />
                )}
                {ragRequestState === "loading" ? "찾는 중" : "질문하기"}
              </button>
            </div>
          </form>

          {ragRequestState === "idle" && (
            <div className="ask-empty">
              <span>
                <MessageCircle size={30} />
              </span>
              <strong>일기 속 기억을 함께 찾아볼게요</strong>
              <p>
                사건, 감정, 사람에 대해 묻거나 “최근에 무엇을 했어?”처럼
                시간에 관한 질문도 할 수 있어요.
              </p>
            </div>
          )}

          {ragRequestState === "loading" && (
            <div className="ask-loading" role="status" aria-live="polite">
              <span className="ask-loading-icon">
                <Sparkles size={25} />
              </span>
              <div>
                <strong>관련 일기를 찾고 있어요</strong>
                <p>의미와 날짜를 함께 살펴본 뒤 답변을 정리할게요.</p>
              </div>
            </div>
          )}

          {ragRequestState === "error" && (
            <div className="ask-error" role="alert">
              <div>
                <strong>답변을 가져오지 못했어요</strong>
                <p>{ragError}</p>
              </div>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => void askDiaryQuestion()}
              >
                <RefreshCw size={17} />
                다시 시도
              </button>
            </div>
          )}

          {ragRequestState === "success" && ragAnswer && (
            <article className="rag-answer-card" aria-live="polite">
              <header className="rag-answer-head">
                <span className="rag-answer-icon">
                  <Sparkles size={22} />
                </span>
                <div>
                  <span className="settings-label">SoriTarae의 답변</span>
                  <strong>
                    {ragAnswer.grounded
                      ? "내 일기에서 찾았어요"
                      : "충분한 기록을 찾지 못했어요"}
                  </strong>
                </div>
              </header>
              <p className="rag-answer-text">{ragAnswer.answer}</p>

              {ragAnswer.sources.length > 0 && (
                <div className="rag-sources">
                  <span className="rag-sources-label">
                    <BookOpen size={16} />
                    참고한 일기
                  </span>
                  <div className="rag-source-list">
                    {ragAnswer.sources.map((source) => (
                      <button
                        key={`${source.sourceNumber}-${source.diaryId}`}
                        type="button"
                        className="rag-source-card"
                        onClick={() => openRagSource(source)}
                      >
                        <span className="rag-source-number">
                          {source.sourceNumber}
                        </span>
                        <span>
                          <strong>{source.title}</strong>
                          <small>
                            {formatFullDate(source.createdAt)}
                            {" · "}
                            {source.retrievalMethod === "recent"
                              ? "최신 기록"
                              : source.retrievalMethod === "both"
                                ? "의미·날짜 일치"
                                : `${Math.round((source.similarity ?? 0) * 100)}% 유사`}
                          </small>
                        </span>
                        <ArrowLeft className="source-arrow" size={17} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rag-caution">
                <ShieldCheck size={17} />
                답변은 선택된 내 일기에만 근거하며, 중요한 내용은 원문도
                함께 확인해 주세요.
              </div>
            </article>
          )}
        </>
      )}
    </section>
  );

  const renderSettings = () => (
    <section className="settings-screen" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">환경 설정</span>
          <h1 id="settings-title">편안한 기록을 위한 설정</h1>
          <p>AI 연결 상태와 일기 저장 위치를 확인할 수 있어요.</p>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card connection-card">
          <span className="settings-icon">
            {connectionReady ? <Wifi size={22} /> : <WifiOff size={22} />}
          </span>
          <div>
            <span className="settings-label">Gemini AI 연결</span>
            <strong>
              {connectionReady === null
                ? "확인 중"
                : connectionReady
                  ? "사용 가능"
                  : "설정 필요"}
            </strong>
            <p>
              {connectionReady
                ? "음성을 분석해 한국어 일기를 만들 준비가 됐어요."
                : "관리자가 Gemini API 연결을 완료하면 AI 일기 만들기를 사용할 수 있어요."}
            </p>
          </div>
          <span
            className={`status-dot ${connectionReady ? "is-ready" : ""}`}
            aria-hidden="true"
          />
        </article>

        <article className="settings-card">
          <span className="settings-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <span className="settings-label">내 일기 검색 준비</span>
            <strong>
              {!authUserId
                ? "로그인 후 사용 가능"
                : embeddingSyncState === "syncing"
                  ? "검색 준비 중"
                  : embeddingSyncState === "ready"
                    ? "검색 준비 완료"
                    : embeddingSyncState === "error"
                      ? "다시 시도 필요"
                      : "준비 대기"}
            </strong>
            <p>
              로그인한 계정의 일기를 의미 기반으로 찾을 수 있도록 768차원
              검색 벡터를 준비해요.
            </p>
            {authUserId && embeddingSyncState !== "syncing" && (
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => void synchronizeAllDiaryEmbeddings()}
              >
                <RefreshCw size={17} />
                {embeddingSyncState === "ready"
                  ? "상태 다시 확인"
                  : "검색 준비 다시 시도"}
              </button>
            )}
          </div>
        </article>

        <article className="settings-card">
          <span className="settings-icon mint">
            <LockKeyhole size={22} />
          </span>
          <div>
            <span className="settings-label">기록 보관</span>
            <strong>{authUserId ? "내 계정의 클라우드에 저장" : "이 기기에만 저장"}</strong>
            <p>
              {authUserId
                ? "완성해 저장한 일기는 Supabase에, 편집 중인 초안은 현재 브라우저에 보관돼요."
                : "저장한 일기와 편집 중인 초안은 현재 브라우저의 로컬 저장소에 보관돼요."}
            </p>
          </div>
        </article>

        <article className="settings-card">
          <span className="settings-icon coral">
            <FileAudio size={22} />
          </span>
          <div>
            <span className="settings-label">오디오 입력</span>
            <strong>녹음 또는 파일 업로드</strong>
            <p>
              녹음은 WAV로 준비되며, WAV·MP3·M4A·AAC·OGG·FLAC 파일을
              4MB까지 처리해요.
            </p>
          </div>
        </article>
      </div>

      <div className="danger-zone">
        <div>
          <strong>저장된 기록 모두 삭제</strong>
          <p>이 작업은 되돌릴 수 없어요.</p>
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={clearHistory}
          disabled={!entriesReady || !entries.length}
        >
          <Trash2 size={17} />
          전체 삭제
        </button>
      </div>
    </section>
  );

  const renderRecordScreen = () => {
    if (screen === "recording") return renderRecording();
    if (screen === "processing") return renderProcessing();
    if (screen === "result") return renderResult();
    if (screen === "editing") return renderEditing();
    if (screen === "error") return renderError();
    return renderIdle();
  };

  return (
    <div className="site-shell">
      <header className="app-header">
        <button
          type="button"
          className="brand"
          onClick={() => switchTab("record")}
          aria-label="SoriTarae 메인"
        >
          <LogoMark />
          <span>
            <strong>SoriTarae</strong>
            <small>목소리로 남기는 나의 하루</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          <button
            type="button"
            className={tab === "record" ? "is-active" : ""}
            onClick={() => switchTab("record")}
          >
            <Mic size={18} />
            기록하기
          </button>
          <button
            type="button"
            className={tab === "history" ? "is-active" : ""}
            onClick={() => switchTab("history")}
          >
            <History size={18} />
            나의 기록
          </button>
          <button
            type="button"
            className={tab === "ask" ? "is-active" : ""}
            onClick={() => switchTab("ask")}
          >
            <MessageCircle size={18} />
            질문하기
          </button>
          <button
            type="button"
            className={tab === "settings" ? "is-active" : ""}
            onClick={() => switchTab("settings")}
          >
            <Settings2 size={18} />
            설정
          </button>
        </nav>

        <div className="header-account">
          <span className="local-badge">
            <LockKeyhole size={15} />
            {!authReady
              ? "저장소 확인 중"
              : authUserId
                ? "클라우드 저장"
                : "로컬 저장"}
          </span>

          {authReady && authEmail ? (
            <>
              <span className="account-email" title={authEmail}>
                <UserRound size={15} />
                <span>{authEmail}</span>
              </span>
              <button
                type="button"
                className="account-button"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut size={15} />
                {isSigningOut ? "처리 중" : "로그아웃"}
              </button>
            </>
          ) : authReady ? (
            <a className="account-button" href="/auth/login">
              <LogIn size={15} />
              로그인
            </a>
          ) : (
            <span className="account-loading" aria-label="로그인 상태 확인 중" />
          )}
        </div>
      </header>

      <main ref={mainRef} tabIndex={-1} className="app-main">
        {tab === "record"
          ? renderRecordScreen()
          : tab === "history"
            ? renderHistory()
            : tab === "ask"
              ? renderAsk()
              : renderSettings()}
      </main>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <button
          type="button"
          className={tab === "record" ? "is-active" : ""}
          onClick={() => switchTab("record")}
        >
          <Mic size={21} />
          <span>기록</span>
        </button>
        <button
          type="button"
          className={tab === "history" ? "is-active" : ""}
          onClick={() => switchTab("history")}
        >
          <History size={21} />
          <span>나의 기록</span>
        </button>
        <button
          type="button"
          className={tab === "ask" ? "is-active" : ""}
          onClick={() => switchTab("ask")}
        >
          <MessageCircle size={21} />
          <span>질문</span>
        </button>
        <button
          type="button"
          className={tab === "settings" ? "is-active" : ""}
          onClick={() => switchTab("settings")}
        >
          <Settings2 size={21} />
          <span>설정</span>
        </button>
      </nav>

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".wav,.mp3,.m4a,.mp4,.aac,.ogg,.flac,.aif,.aiff,audio/*"
        onChange={handleFile}
      />

      {exportOpen && currentDiary && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setExportOpen(false);
          }}
        >
          <section
            className="export-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <div className="sheet-handle" />
            <div className="export-head">
              <div>
                <span className="eyebrow">저장 완료</span>
                <h2 id="export-title">어떻게 내보낼까요?</h2>
              </div>
              <IconButton label="내보내기 닫기" onClick={() => setExportOpen(false)}>
                <X size={20} />
              </IconButton>
            </div>
            <p className="export-preview">{currentDiary.title}</p>
            <div className="export-options">
              <button type="button" onClick={downloadDiary}>
                <span>
                  <Download size={22} />
                </span>
                텍스트 파일
              </button>
              <button type="button" onClick={copyDiary}>
                <span>
                  <Copy size={22} />
                </span>
                내용 복사
              </button>
              <button type="button" onClick={shareDiary}>
                <span>
                  <Share2 size={22} />
                </span>
                공유하기
              </button>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setExportOpen(false);
                switchTab("history");
              }}
            >
              <History size={18} />
              저장된 기록 보기
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
