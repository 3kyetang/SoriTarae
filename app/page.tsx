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
  Mic,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Upload,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DiaryStyle = "basic" | "focus";
type Screen =
  | "idle"
  | "recording"
  | "processing"
  | "result"
  | "editing"
  | "error";
type Tab = "record" | "history" | "settings";

type DiaryEntry = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  mood: string;
  keywords: string[];
  style: DiaryStyle;
  transcriptSummary: string;
};

type AppError = {
  title: string;
  message: string;
  tip: string;
  kind: "audio" | "permission" | "connection" | "general";
};

const STYLE_OPTIONS: Array<{
  value: DiaryStyle;
  label: string;
  short: string;
  description: string;
}> = [
  {
    value: "basic",
    label: "ê¸°ë³¸í˜•",
    short: "ìžì—°ìŠ¤ëŸ¬ìš´ ì¼ê¸°",
    description: "í•˜ë£¨ì˜ íë¦„ê³¼ ê°ì •ì„ ì°¨ë¶„í•˜ê²Œ ì •ë¦¬í•´ìš”.",
  },
  {
    value: "focus",
    label: "í•µì‹¬ ìš”ì•½",
    short: "ì¤‘ìš”í•œ ìˆœê°„ ì¤‘ì‹¬",
    description: "ê¼­ ê¸°ì–µí•˜ê³  ì‹¶ì€ ìž¥ë©´ì„ ì¤‘ì‹¬ìœ¼ë¡œ ì •ë¦¬í•´ìš”.",
  },
];

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

const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const HISTORY_KEY = "voicelog.entries.v1";
const EDIT_DRAFT_KEY = "voicelog.edit-draft.v1";

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

export default function VoiceLogApp() {
  const [tab, setTab] = useState<Tab>("record");
  const [screen, setScreen] = useState<Screen>("idle");
  const [style, setStyle] = useState<DiaryStyle>("focus");
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const historyHydratedRef = useRef(false);

  const selectedStyle = useMemo(
    () => STYLE_OPTIONS.find((option) => option.value === style)!,
    [style],
  );

  const processingMessage =
    processingProgress < 34
      ? "ëª©ì†Œë¦¬ì˜ íë¦„ì„ ì½ê³  ìžˆì–´ìš”"
      : processingProgress < 68
        ? "ì¤‘ìš”í•œ ìˆœê°„ì„ ê³¨ë¼ë‚´ê³  ìžˆì–´ìš”"
        : "ì„ íƒí•œ ìŠ¤íƒ€ì¼ë¡œ ì¼ê¸°ë¥¼ ë‹¤ë“¬ê³  ìžˆì–´ìš”";

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  useEffect(() => {
    let savedEntries: DiaryEntry[] | null = null;
    try {
      const saved = window.localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          savedEntries = (parsed as DiaryEntry[]).map((entry) => ({
            ...entry,
            style: entry.style === "basic" ? "basic" : "focus",
          }));
        }
      }
    } catch {
      // A corrupt or unavailable local store should never block the recorder.
    }

    const hydrationTimer = window.setTimeout(() => {
      historyHydratedRef.current = true;
      if (savedEntries) setEntries(savedEntries);
    }, 0);

    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) =>
        setConnectionReady(Boolean(data.configured)),
      )
      .catch(() => setConnectionReady(false));

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!historyHydratedRef.current) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch {
      // Local history is best-effort device storage.
    }
  }, [entries]);

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
      showToast("ì§„í–‰ ì¤‘ì¸ ìž‘ì—…ì„ ë¨¼ì € ë§ˆì³ ì£¼ì„¸ìš”.");
      return;
    }
    setTab(nextTab);
    if (nextTab === "record") setScreen("idle");
  };

  const generateDiary = useCallback(
    async (blob: Blob, selected: DiaryStyle) => {
      setAudioBlob(blob);
      setAppError(null);
      setProcessingProgress(8);
      setScreen("processing");

      const controller = new AbortController();
      requestAbortRef.current = controller;

      const filename =
        blob instanceof File && blob.name ? blob.name : "voicelog-recording.wav";
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
              title: "AI ì—°ê²° ì¤€ë¹„ê°€ í•„ìš”í•´ìš”",
              message:
                "ë…¹ìŒì€ ìž˜ ì™„ë£Œëì§€ë§Œ ì•„ì§ ì¼ê¸° ìƒì„± ì—°ê²°ì´ ì¤€ë¹„ë˜ì§€ ì•Šì•˜ì–´ìš”.",
              tip: "ì—°ê²°ì´ ì™„ë£Œëœ ë’¤ ë‹¤ì‹œ ì‹œë„í•˜ê±°ë‚˜, ì§€ê¸ˆì€ ì§ì ‘ í…ìŠ¤íŠ¸ë¡œ ê¸°ë¡í•  ìˆ˜ ìžˆì–´ìš”.",
              kind: "connection",
            });
          } else {
            setAppError({
              title: "ìŒì„±ì„ ì¼ê¸°ë¡œ ë°”ê¾¸ì§€ ëª»í–ˆì–´ìš”",
              message:
                upstreamMessage ||
                "ìŒì„±ì´ ë„ˆë¬´ ì§§ê±°ë‚˜ ì£¼ë³€ ì†ŒìŒì´ ì»¤ì„œ ë‚´ìš©ì„ ì¶©ë¶„ížˆ ì´í•´í•˜ì§€ ëª»í–ˆì–´ìš”.",
              tip: "ì¡°ìš©í•œ ê³³ì—ì„œ 5ì´ˆ ì´ìƒ ë§í•˜ê±°ë‚˜, ì§€ì›ë˜ëŠ” ì˜¤ë””ì˜¤ íŒŒì¼ì„ ì˜¬ë ¤ ì£¼ì„¸ìš”.",
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
          title: payload.diary.title?.trim() || "ì˜¤ëŠ˜ì˜ ê¸°ë¡",
          body: payload.diary.body?.trim() || "",
          mood: payload.diary.mood?.trim() || "ì°¨ë¶„í•¨",
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
        if (error instanceof DOMException && error.name === "AbortErëÎµ¶‰žËkºwµçeØ±…ÍÍ9…µ”ô‰•‘¥Ñ½Èµ¡•…ˆø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰‰…¬µ‰ÕÑÑ½¸ˆ(€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑMÉ••¸¡ÕÉÉ•¹Ñ¥…Éä€ü€‰É•ÍÕ±Ðˆ€è€‰¥‘±”ˆ¥ô(€€€€€€€€ø(€€€€€€€€€€ñÉÉ½Ý1•™ÐÍ¥é”õìÈÁô€¼ø(€€€€€€€€€ƒ®>3²VªÂªâÀ(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Õ¹‘¼µ½¹ÑÉ½±Ìˆø(€€€€€€€€€€ñ%½¹	ÕÑÑ½¸(€€€€€€€€€€€±…‰•°ô‹².“¶Z$ƒ²Þ£²0ˆ(€€€€€€€€€€€½¹±¥¬õíÕ¹‘½‘¥Ñô(€€€€€€€€€€€‘¥Í…‰±•õí•‘¥Ñ%¹‘•à€ðô€Áô(€€€€€€€€€€ø(€€€€€€€€€€€€ñU¹‘¼ÈÍ¥é”õìÄáô€¼ø(€€€€€€€€€€ð½%½¹	ÕÑÑ½¸ø(€€€€€€€€€€ñ%½¹	ÕÑÑ½¸(€€€€€€€€€€€±…‰•°ô‹®.“².pƒ².“¶Z$ˆ(€€€€€€€€€€€½¹±¥¬õíÉ•‘½‘¥Ñô(€€€€€€€€€€€‘¥Í…‰±•õí•‘¥Ñ%¹‘•à€øô•‘¥Ñ!¥ÍÑ½Éä¹±•¹Ñ €´€Åô(€€€€€€€€€€ø(€€€€€€€€€€€€ñI•‘¼ÈÍ¥é”õìÄáô€¼ø(€€€€€€€€€€ð½%½¹	ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆùíµ…¹Õ…±¹ÑÉä€ü€‹²ž²‚Dƒ²zG²Äˆ€è€‹²vóªâÀƒ®.“®N³ªâÀ‰ôð½ÍÁ…¸ø(€€€€€€ñ Ä¥ô‰•‘¥Ñ½ÈµÑ¥Ñ±”ˆø(€€€€€€€íµ…¹Õ…±¹ÑÉä€ü€‹²b“®*c²v`ƒªâÃ®†w²vƒ²‚²ZÓ®ÎÓ²ã²jPˆ€è€‹®
Ðƒ²vÓ²VóªâÃ®.×ªÊ0ƒ®.“®N³²ZÐƒ®ÎÓ²ã²jP‰ô(€€€€€€ð½ Äø(€€€€€€ñÀ±…ÍÍ9…µ”ô‰•‘¥Ñ½Èµ±•…ˆø(€€€€€€€ƒ²Ös²ŠƒªâÃ®†w²v`ƒ²Žó²ÊÓ®*Pƒ®
c²b#²jP¸ƒ²
³².“ªÎðƒ®.“®–àƒ®Ú®Ú²vÓ®
`ƒªÂC²‚Tƒ¶Fs¶b²vƒ¶:ã¶VcªÊ0(€€€€€€€ƒªÎƒ²Î@ƒ²Žó²ã²jP¸(€€€€€€ð½Àø((€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰•‘¥Ñ½ÈµÑ¥Ñ±”µ™¥•±ˆø(€€€€€€€€ñÍÁ…¸û²‚s®ª¤ð½ÍÁ…¸ø(€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€Ù…±Õ”õí•‘¥ÑQ¥Ñ±•ô(€€€€€€€€€µ…á1•¹Ñ õìØÁô(€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ‘¥ÑQ¥Ñ±”¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€Á±…•¡½±‘•Èô‹²b“®*c²v`ƒªâÃ®†tˆ(€€€€€€€€¼ø(€€€€€€ð½±…‰•°ø(€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰•‘¥Ñ½Èµ‰½‘äµ™¥•±ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰ÍÈµ½¹±äˆû²vóªâÀƒ®
Ó²j¤ð½ÍÁ…¸ø(€€€€€€€€ñÑ•áÑ…É•„(€€€€€€€€€Ù…±Õ”õí•‘¥Ñ	½‘åô(€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÕÁ‘…Ñ•‘¥Ñ	½‘ä¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€µ…á1•¹Ñ õìÄÀÀÁô(€€€€€€€€€…ÕÑ½½ÕÌ(€€€€€€€€€Á±…•¡½±‘•Èô‹²b“®*`ƒ²z#²^#®6`ƒ²vóªÎðƒªÞã®V3²v`ƒ®ž#²v3²vƒ²zC²rƒ®†·ªÊ0ƒ²‚²ZÓ®ÎÓ²ã²jP¸ˆ(€€€€€€€€¼ø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡…É…Ñ•Èµ½Õ¹Ðˆùí•‘¥Ñ	½‘ä¹±•¹Ñ¡ô€¼€ÄÀÀÀð½ÍÁ…¸ø(€€€€€€ð½±…‰•°ø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ½Í…Ù”µ¹½Ñ”ˆø(€€€€€€€€ñ¡•­¥É±”ÈÍ¥é”õìÄÙô€¼ø(€€€€€€€ƒ²vÐƒªâÃªâÃ²^@ƒ²Ò#²V#²vÐƒ²zC®>dƒ²‚²z—®>ó²jP¸(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•‘¥Ñ½Èµ…Ñ¥½¹Ìˆø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•ÍÑ½É•É…™Ñôø(€€€€€€€€€€ñI½Ñ…Ñ•ÜÍ¥é”õìÄáô€¼ø(€€€€€€€€€íµ…¹Õ…±¹ÑÉä€ü€‹®
Ó²j¤ƒ®æ²jÃªâÀˆ€è€‰$ƒ²Ò#²V#²ró®†pƒ®Î×²n@‰ô(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õí™¥¹¥Í¡‘¥Ñ¥¹ôø(€€€€€€€€€€ñ¡•¬Í¥é”õìÄåô€¼ø(€€€€€€€€€ƒ²"c²‚Tƒ²f®Ž0(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€¤ì((€½¹ÍÐÉ•¹‘•ÉÉÉ½È€ô€ ¤€ôøì(€€€½¹ÍÐ•ÉÉ½È€ô…ÁÁÉÉ½È€üüì(€€€€€Ñ¥Ñ±”è€‹²zƒ².pƒ®²ã²‚sªÂ ƒ²wªÊó²ZÓ²jPˆ°(€€€€€µ•ÍÍ…”è€‹²jS²Ê·²vƒ®ž#²æc²ž ƒ®ªï¶Z#²ZÓ²jP¸ˆ°(€€€€€Ñ¥Àè€‹²zƒ².pƒ¶nƒ®.“².pƒ².s®>¶VÐƒ²Žó²ã²jP¸ˆ°(€€€€€­¥¹è€‰•¹•É…°ˆ…Ì½¹ÍÐ°(€€€ôì(€€€É•ÑÕÉ¸€ (€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰™½ÕÌµÁ…¹•°•ÉÉ½ÈµÁ…¹•°ˆ…É¥„µ±…‰•±±•‘‰äô‰•ÉÉ½ÈµÑ¥Ñ±”ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí•ÉÉ½Èµ¥½¸•ÉÉ½È´‘í•ÉÉ½È¹­¥¹‘õôø(€€€€€€€€€í•ÉÉ½È¹­¥¹€ôôô€‰½¹¹•Ñ¥½¸ˆ€ü€ (€€€€€€€€€€€€ñ]¥™¥=™˜Í¥é”õìÐÉô€¼ø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€€ñY½±Õµ•`Í¥é”õìÐÉô€¼ø(€€€€€€€€€€¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆû®.“².pƒ².s®>¶V€ƒ²"`ƒ²z#²ZÓ²jPð½ÍÁ…¸ø(€€€€€€€€ñ Ä¥ô‰•ÉÉ½ÈµÑ¥Ñ±”ˆùí•ÉÉ½È¹Ñ¥Ñ±•ôð½ Äø(€€€€€€€€ñÀùí•ÉÉ½È¹µ•ÍÍ…•ôð½Àø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•ÉÉ½ÈµÑ¥Àˆø(€€€€€€€€€€ñ!•…‘Á¡½¹•ÌÍ¥é”õìÄåô€¼ø(€€€€€€€€€í•ÉÉ½È¹Ñ¥Áô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•ÉÉ½Èµ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€½¹±¥¬õíÍÑ…ÉÑI•½É‘¥¹ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñ5¥ŒÍ¥é”õìÄåô€¼ø(€€€€€€€€€€€ƒ®.“².pƒ®ç²v3¶VcªâÀ(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€í…Õ‘¥½	±½ˆ€˜˜•ÉÉ½È¹­¥¹€ôôô€‰½¹¹•Ñ¥½¸ˆ€˜˜€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€½¹±¥¬õíÉ••¹•É…Ñ•ô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñI•™É•Í¡ÜÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€€€ƒ®.“².pƒ²w²Ä(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€¥ô(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€½¹±¥¬õì ¤€ôø™¥±•%¹ÁÕÑI•˜¹ÕÉÉ•¹Ðü¹±¥¬ ¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñUÁ±½…Í¥é”õìÄáô€¼ø(€€€€€€€€€€€ƒ¶23²vðƒ²^®†s®Np(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Ñ•áÐµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÍÑ…ÉÑ5…¹Õ…±¹ÑÉåôø(€€€€€€€€€€€€ñ¥±•Q•áÐÍ¥é”õìÄÝô€¼ø(€€€€€€€€€€€ƒ²ž²‚Dƒ¶7²*“¶*àƒ²zG²Ä(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÍÕ‰Ñ±”µ±¥¹¬ˆ½¹±¥¬õì ¤€ôøÍ•ÑMÉ••¸ ‰¥‘±”ˆ¥ôø(€€€€€€€€€ƒ®¦S²vã²ró®†pƒ®>3²VªÂªâÀ(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½Í•Ñ¥½¸ø(€€€€¤ì(€ôì((€½¹ÍÐÉ•¹‘•É!¥ÍÑ½Éä€ô€ ¤€ôø€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¡¥ÍÑ½ÉäµÍÉ••¸ˆ…É¥„µ±…‰•±±•‘‰äô‰¡¥ÍÑ½ÉäµÑ¥Ñ±”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆû®
c²v`ƒªâÃ®†tð½ÍÁ…¸ø(€€€€€€€€€€ñ Ä¥ô‰¡¥ÍÑ½ÉäµÑ¥Ñ±”ˆû®.“².pƒ¶:ó²ÎC®ÎÓ®*Pƒ¶Vc®Ž ð½ Äø(€€€€€€€€€€ñÀû²‚²z—¶Vpƒ²vóªâÃ®*Pƒ²vÐƒªâÃªâÃ²^C®ž0ƒ®ÎÓªÒ®>ó²jP¸ð½Àø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸½µÁ…Ðµ‰ÕÑÑ½¸ˆ(€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰É•½Éˆ¥ô(€€€€€€€€ø(€€€€€€€€€€ñA±ÕÌÍ¥é”õìÄáô€¼ø(€€€€€€€€€ƒ² ƒªâÃ®†t(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø((€€€€€í•¹ÑÉ¥•Ì¹±•¹Ñ €ôôô€À€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµ¥±±ÕÍÑÉ…Ñ¥½¸ˆø(€€€€€€€€€€€€ñ	½½­=Á•¸Í¥é”õìÌáô€¼ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ Èû²V²žƒ²‚²z—¶Vpƒ²vóªâÃªÂ ƒ²^²ZÓ²jPð½ Èø(€€€€€€€€€€ñÀû²b“®*c²v`ƒ²vÓ²VóªâÃ®–ðƒ®N“®‚“²Žó®¦Ðƒ²Ê¬ƒ®Ê#²žàƒªâÃ®†w²vÐƒ²vÓªÎÏ²^@ƒ²2O²^³²jP¸ð½Àø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰É•½Éˆ¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñ5¥ŒÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€ƒ²Ê¬ƒ²vóªâÀƒ®ž3®N“ªâÀ(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµ±¥ÍÐˆø(€€€€€€€€€í•¹ÑÉ¥•Ì¹µ…À ¡•¹ÑÉä¤€ôøì(€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸€ô(€€€€€€€€€€€€€MQe1}=AQ%=9L¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹Ù…±Õ”€ôôô•¹ÑÉä¹ÍÑå±”¤€üü(€€€€€€€€€€€€€MQe1}=AQ%=9MlÁtì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ…ÉÑ¥±”­•äõí•¹ÑÉä¹¥‘ô±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµ…Éˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµ…Éµµ…¥¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø½Á•¹!¥ÍÑ½Éå¹ÑÉä¡•¹ÑÉä¥ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµ‘…Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí™½Éµ…ÑM¡½ÉÑ…Ñ”¡•¹ÑÉä¹É•…Ñ•‘Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€€€€€€€€€í¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ð ‰­¼µ-Hˆ°ì(€€€€€€€€€€€€€€€€€€€€€€€Ý••­‘…äè€‰Í¡½ÉÐˆ°(€€€€€€€€€€€€€€€€€€€€€ô¤¹™½Éµ…Ð¡¹•Ü…Ñ”¡•¹ÑÉä¹É•…Ñ•‘Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµ½¹Ñ•¹Ðˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡¥ÍÑ½Éäµµ•Ñ„ˆø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí½ÁÑ¥½¸¹±…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí•¹ÑÉä¹µ½½‘ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí•¹ÑÉä¹Ñ¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí•¹ÑÉä¹‰½‘åôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ%½¹	ÕÑÑ½¸(€€€€€€€€€€€€€€€€€±…‰•°õí€‘í•¹ÑÉä¹Ñ¥Ñ±•ôƒ²
·²‚qô(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø‘•±•Ñ•¹ÑÉä¡•¹ÑÉä¹¥¥ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñQÉ…Í ÈÍ¥é”õìÄÝô€¼ø(€€€€€€€€€€€€€€€€ð½%½¹	ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô(€€€€ð½Í•Ñ¥½¸ø(€€¤ì((€½¹ÍÐÉ•¹‘•ÉM•ÑÑ¥¹Ì€ô€ ¤€ôø€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹ÌµÍÉ••¸ˆ…É¥„µ±…‰•±±•‘‰äô‰Í•ÑÑ¥¹ÌµÑ¥Ñ±”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆû¶fcªÊôƒ²“²‚Tð½ÍÁ…¸ø(€€€€€€€€€€ñ Ä¥ô‰Í•ÑÑ¥¹ÌµÑ¥Ñ±”ˆû¶:ã²V#¶VpƒªâÃ®†w²vƒ²r¶Vpƒ²“²‚Tð½ Äø(€€€€€€€€€€ñÀû²^ÃªÊÀƒ²¶s²f ƒ²vÐƒªâÃªâÃ²^@ƒ®
£®*Pƒ®6Ã²vÓ¶Ã®–ðƒ¶fW²vã¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ð½Àø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹ÌµÉ¥ˆø(€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ…É½¹¹•Ñ¥½¸µ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ¥½¸ˆø(€€€€€€€€€€€í½¹¹•Ñ¥½¹I•…‘ä€ü€ñ]¥™¤Í¥é”õìÈÉô€¼ø€è€ñ]¥™¥=™˜Í¥é”õìÈÉô€¼ùô(€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ±…‰•°ˆù•µ¥¹¤$ƒ²^ÃªÊÀð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÑÉ½¹œø(€€€€€€€€€€€€€í½¹¹•Ñ¥½¹I•…‘ä€ôôô¹Õ±°(€€€€€€€€€€€€€€€€ü€‹¶fW²vàƒ²’Dˆ(€€€€€€€€€€€€€€€€è½¹¹•Ñ¥½¹I•…‘ä(€€€€€€€€€€€€€€€€€€ü€‹²
³²j¤ƒªÂ®*”ˆ(€€€€€€€€€€€€€€€€€€è€‹²“²‚Tƒ¶V²jP‰ô(€€€€€€€€€€€€ð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÀø(€€€€€€€€€€€€€í½¹¹•Ñ¥½¹I•…‘ä(€€€€€€€€€€€€€€€€ü€‹²v3²Ç²vƒ®Ú²w¶VÐƒ¶VsªÖ·²ZÐƒ²vóªâÃ®–ðƒ®ž3®Nƒ²’®æªÂ ƒ®BC²ZÓ²jP¸ˆ(€€€€€€€€€€€€€€€€è€‹ªÒ®š³²zCªÂ •µ¥¹¤A$ƒ²^ÃªÊÃ²vƒ²f®Ž3¶Vc®¦Ð$ƒ²vóªâÀƒ®ž3®N“ªâÃ®–ðƒ²
³²j§¶V€ƒ²"`ƒ²z#²ZÓ²jP¸‰ô(€€€€€€€€€€€€ð½Àø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñÍÁ…¸(€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑ…ÑÕÌµ‘½Ð€‘í½¹¹•Ñ¥½¹I•…‘ä€ü€‰¥ÌµÉ•…‘äˆ€è€ˆ‰õô(€€€€€€€€€€€…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ(€€€€€€€€€€¼ø(€€€€€€€€ð½…ÉÑ¥±”ø((€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ¥½¸µ¥¹Ðˆø(€€€€€€€€€€€€ñ1½­-•å¡½±”Í¥é”õìÈÉô€¼ø(€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ±…‰•°ˆûªâÃ®†tƒ®ÎÓªÒ ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÑÉ½¹œû²vÐƒªâÃªâÃ²^C®ž0ƒ²‚²z”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÀø(€€€€€€€€€€€€€ƒ²‚²z—¶Vpƒ²vóªâÃ²f ƒ¶:ã²žDƒ²’G²vàƒ²Ò#²V#²v ƒ¶b²z°ƒ®â3®vó²jÃ²‚²v`ƒ®†s²î°ƒ²‚²z—²3²^@(€€€€€€€€€€€€€ƒ®ÎÓªÒ®>ó²jP¸(€€€€€€€€€€€€ð½Àø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½…ÉÑ¥±”ø((€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ…Éˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ¥½¸½É…°ˆø(€€€€€€€€€€€€ñ¥±•Õ‘¥¼Í¥é”õìÈÉô€¼ø(€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ±…‰•°ˆû²b“®RS²bƒ²z®‚”ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÑÉ½¹œû®ç²v0ƒ®bC®*Pƒ¶23²vðƒ²^®†s®Npð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÀø(€€€€€€€€€€€€€ƒ®ç²v3²v ][®†pƒ²’®æ®Bc®¦À°][
Ý5@Ï
Ý4Ñ
Ý
Ý=
Ý1ƒ¶23²vó²v(€€€€€€€€€€€€€€ÄÑ5ªæ3²ž ƒ²Êc®š³¶VÓ²jP¸(€€€€€€€€€€€€ð½Àø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘…¹•Èµé½¹”ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÑÉ½¹œû²‚²z—®BpƒªâÃ®†tƒ®ª£®F@ƒ²
·²‚pð½ÍÑÉ½¹œø(€€€€€€€€€€ñÀû²vÐƒ²zG²^²v ƒ®Bc®>3®šÐƒ²"`ƒ²^²ZÓ²jP¸ð½Àø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰‘…¹•Èµ‰ÕÑÑ½¸ˆ(€€€€€€€€€½¹±¥¬õí±•…É!¥ÍÑ½Éåô(€€€€€€€€€‘¥Í…‰±•õì…•¹ÑÉ¥•Ì¹±•¹Ñ¡ô(€€€€€€€€ø(€€€€€€€€€€ñQÉ…Í ÈÍ¥é”õìÄÝô€¼ø(€€€€€€€€€ƒ²‚²ÊÐƒ²
·²‚p(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€¤ì((€½¹ÍÐÉ•¹‘•ÉI•½É‘MÉ••¸€ô€ ¤€ôøì(€€€¥˜€¡ÍÉ••¸€ôôô€‰É•½É‘¥¹œˆ¤É•ÑÕÉ¸É•¹‘•ÉI•½É‘¥¹œ ¤ì(€€€¥˜€¡ÍÉ••¸€ôôô€‰ÁÉ½•ÍÍ¥¹œˆ¤É•ÑÕÉ¸É•¹‘•ÉAÉ½•ÍÍ¥¹œ ¤ì(€€€¥˜€¡ÍÉ••¸€ôôô€‰É•ÍÕ±Ðˆ¤É•ÑÕÉ¸É•¹‘•ÉI•ÍÕ±Ð ¤ì(€€€¥˜€¡ÍÉ••¸€ôôô€‰•‘¥Ñ¥¹œˆ¤É•ÑÕÉ¸É•¹‘•É‘¥Ñ¥¹œ ¤ì(€€€¥˜€¡ÍÉ••¸€ôôô€‰•ÉÉ½Èˆ¤É•ÑÕÉ¸É•¹‘•ÉÉÉ½È ¤ì(€€€É•ÑÕÉ¸É•¹‘•É%‘±” ¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µÍ¡•±°ˆø(€€€€€€ñ¡•…‘•È±…ÍÍ9…µ”ô‰…ÁÀµ¡•…‘•Èˆø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰‰É…¹ˆ(€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰É•½Éˆ¥ô(€€€€€€€€€…É¥„µ±…‰•°ô‰Y½¥•1½œƒ®¦S²vàˆ(€€€€€€€€ø(€€€€€€€€€€ñ1½½5…É¬€¼ø(€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€ñÍÑÉ½¹œùY½¥•1½œð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÍµ…±°û®ª§²3®š³®†pƒ®
£ªâÃ®*Pƒ®
c²v`ƒ¶Vc®Ž ð½Íµ…±°ø(€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€ñ¹…Ø±…ÍÍ9…µ”ô‰‘•Í­Ñ½Àµ¹…Øˆ…É¥„µ±…‰•°ô‹²Žó²jPƒ®¦S®&Ðˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰É•½Éˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰É•½Éˆ¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñ5¥ŒÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€ƒªâÃ®†w¶VcªâÀ(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰¡¥ÍÑ½Éäˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰¡¥ÍÑ½Éäˆ¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñ!¥ÍÑ½ÉäÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€ƒ®
c²v`ƒªâÃ®†t(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰Í•ÑÑ¥¹Ìˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰Í•ÑÑ¥¹Ìˆ¥ô(€€€€€€€€€€ø(€€€€€€€€€€€€ñM•ÑÑ¥¹ÌÈÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€ƒ²“²‚T(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½¹…Øø((€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰±½…°µ‰…‘”ˆø(€€€€€€€€€€ñ1½­-•å¡½±”Í¥é”õìÄÕô€¼ø(€€€€€€€€€ƒ®†s²î°ƒ²‚²z”(€€€€€€€€ð½ÍÁ…¸ø(€€€€€€ð½¡•…‘•Èø((€€€€€€ñµ…¥¸É•˜õíµ…¥¹I•™ôÑ…‰%¹‘•àõì´Åô±…ÍÍ9…µ”ô‰…ÁÀµµ…¥¸ˆø(€€€€€€€íÑ…ˆ€ôôô€‰É•½Éˆ(€€€€€€€€€€üÉ•¹‘•ÉI•½É‘MÉ••¸ ¤(€€€€€€€€€€èÑ…ˆ€ôôô€‰¡¥ÍÑ½Éäˆ(€€€€€€€€€€€€üÉ•¹‘•É!¥ÍÑ½Éä ¤(€€€€€€€€€€€€èÉ•¹‘•ÉM•ÑÑ¥¹Ì ¥ô(€€€€€€ð½µ…¥¸ø((€€€€€€ñ¹…Ø±…ÍÍ9…µ”ô‰µ½‰¥±”µ¹…Øˆ…É¥„µ±…‰•°ô‹²Žó²jPƒ®¦S®&Ðˆø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰É•½Éˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰É•½Éˆ¥ô(€€€€€€€€ø(€€€€€€€€€€ñ5¥ŒÍ¥é”õìÈÅô€¼ø(€€€€€€€€€€ñÍÁ…¸ûªâÃ®†tð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰¡¥ÍÑ½Éäˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰¡¥ÍÑ½Éäˆ¥ô(€€€€€€€€ø(€€€€€€€€€€ñ!¥ÍÑ½ÉäÍ¥é”õìÈÅô€¼ø(€€€€€€€€€€ñÍÁ…¸û®
c²v`ƒªâÃ®†tð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”õíÑ…ˆ€ôôô€‰Í•ÑÑ¥¹Ìˆ€ü€‰¥Ìµ…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€½¹±¥¬õì ¤€ôøÍÝ¥Ñ¡Q…ˆ ‰Í•ÑÑ¥¹Ìˆ¥ô(€€€€€€€€ø(€€€€€€€€€€ñM•ÑÑ¥¹ÌÈÍ¥é”õìÈÅô€¼ø(€€€€€€€€€€ñÍÁ…¸û²“²‚Tð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½¹…Øø((€€€€€€ñ¥¹ÁÕÐ(€€€€€€€É•˜õí™¥±•%¹ÁÕÑI•™ô(€€€€€€€±…ÍÍ9…µ”ô‰ÍÈµ½¹±äˆ(€€€€€€€ÑåÁ”ô‰™¥±”ˆ(€€€€€€€…•ÁÐôˆ¹Ý…Ø°¹µÀÌ°¹´Ñ„°¹µÀÐ°¹……Œ°¹½œ°¹™±…Œ°¹…¥˜°¹…¥™˜±…Õ‘¥¼¼¨ˆ(€€€€€€€½¹¡…¹”õí¡…¹‘±•¥±•ô(€€€€€€¼ø((€€€€€í•áÁ½ÉÑ=Á•¸€˜˜ÕÉÉ•¹Ñ¥…Éä€˜˜€ (€€€€€€€€ñ‘¥Ø(€€€€€€€€€±…ÍÍ9…µ”ô‰µ½‘…°µ‰…­‘É½Àˆ(€€€€€€€€€É½±”ô‰ÁÉ•Í•¹Ñ…Ñ¥½¸ˆ(€€€€€€€€€½¹5½ÕÍ•½Ý¸õì¡•Ù•¹Ð¤€ôøì(€€€€€€€€€€€¥˜€¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð€ôôô•Ù•¹Ð¹Ñ…É•Ð¤Í•ÑáÁ½ÉÑ=Á•¸¡™…±Í”¤ì(€€€€€€€€€õô(€€€€€€€€ø(€€€€€€€€€€ñÍ•Ñ¥½¸(€€€€€€€€€€€±…ÍÍ9…µ”ô‰•áÁ½ÉÐµÍ¡••Ðˆ(€€€€€€€€€€€É½±”ô‰‘¥…±½œˆ(€€€€€€€€€€€…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ(€€€€€€€€€€€…É¥„µ±…‰•±±•‘‰äô‰•áÁ½ÉÐµÑ¥Ñ±”ˆ(€€€€€€€€€€ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¡••Ðµ¡…¹‘±”ˆ€¼ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•áÁ½ÉÐµ¡•…ˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆû²‚²z”ƒ²f®Ž0ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ È¥ô‰•áÁ½ÉÐµÑ¥Ñ±”ˆû²ZÓ®ZïªÊ0ƒ®
Ó®ÎÓ®
óªæ3²jPüð½ Èø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ%½¹	ÕÑÑ½¸±…‰•°ô‹®
Ó®ÎÓ®
ÓªâÀƒ®.¯ªâÀˆ½¹±¥¬õì ¤€ôøÍ•ÑáÁ½ÉÑ=Á•¸¡™…±Í”¥ôø(€€€€€€€€€€€€€€€€ñ`Í¥é”õìÈÁô€¼ø(€€€€€€€€€€€€€€ð½%½¹	ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰•áÁ½ÉÐµÁÉ•Ù¥•ÜˆùíÕÉÉ•¹Ñ¥…Éä¹Ñ¥Ñ±•ôð½Àø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•áÁ½ÉÐµ½ÁÑ¥½¹Ìˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí‘½Ý¹±½…‘¥…Éåôø(€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…Í¥é”õìÈÉô€¼ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€ƒ¶7²*“¶*àƒ¶23²vð(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí½Áå¥…Éåôø(€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñ½ÁäÍ¥é”õìÈÉô€¼ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€ƒ®
Ó²j¤ƒ®Î×²
°(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õíÍ¡…É•¥…Éåôø(€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñM¡…É”ÈÍ¥é”õìÈÉô€¼ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€ƒªÎ×²rƒ¶VcªâÀ(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€Í•ÑáÁ½ÉÑ=Á•¸¡™…±Í”¤ì(€€€€€€€€€€€€€€€ÍÝ¥Ñ¡Q…ˆ ‰¡¥ÍÑ½Éäˆ¤ì(€€€€€€€€€€€€€õô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñ!¥ÍÑ½ÉäÍ¥é”õìÄáô€¼ø(€€€€€€€€€€€€€ƒ²‚²z—®BpƒªâÃ®†tƒ®ÎÓªâÀ(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô((€€€€€íÑ½…ÍÐ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½…ÍÐˆÉ½±”ô‰ÍÑ…ÑÕÌˆ…É¥„µ±¥Ù”ô‰Á½±¥Ñ”ˆø(€€€€€€€€€€ñ¡•­¥É±”ÈÍ¥é”õìÄáô€¼ø(€€€€€€€€€íÑ½…ÍÑô(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô(€€€€ð½‘¥Øø(€€¤ì)ô(