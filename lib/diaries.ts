export type DiaryStyle = "basic" | "focus" | "manual";

export type DiaryEntry = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  mood: string;
  keywords: string[];
  style: DiaryStyle;
  transcriptSummary: string;
};

export type DiaryRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  mood: string | null;
  keywords: string[] | null;
  style: string;
  transcript_summary: string | null;
  created_at: string;
  updated_at: string;
};

export function diaryRowToEntry(row: DiaryRow): DiaryEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    body: row.body,
    mood: row.mood ?? "",
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    style:
      row.style === "basic" || row.style === "manual" ? row.style : "focus",
    transcriptSummary: row.transcript_summary ?? "",
  };
}

export function diaryEntryToRow(entry: DiaryEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    body: entry.body,
    mood: entry.mood || null,
    keywords: entry.keywords,
    style: entry.style,
    transcript_summary: entry.transcriptSummary || null,
    created_at: entry.createdAt,
  };
}
