import "server-only";

export const RECENT_DIARY_COUNT = 3;
export const MAX_RAG_SOURCES = 5;

const RECENCY_TERMS =
  /(가장\s*최근|최근|요즘|요새|근래|마지막으로|마지막\s*기록|최근\s*기록)/u;

export type RetrievalMethod = "semantic" | "recent" | "both";

export type RetrievedDiary = {
  diaryId: string;
  title: string;
  content: string;
  createdAt: string;
  similarity: number | null;
  retrievalMethod: RetrievalMethod;
};

export function hasRecencyIntent(question: string) {
  return RECENCY_TERMS.test(question.normalize("NFKC"));
}

export function mergeHybridResults(
  semanticResults: RetrievedDiary[],
  recentResults: RetrievedDiary[],
) {
  const merged = new Map<string, RetrievedDiary>();

  for (const result of [...recentResults, ...semanticResults]) {
    const existing = merged.get(result.diaryId);
    if (!existing) {
      merged.set(result.diaryId, result);
      continue;
    }

    merged.set(result.diaryId, {
      ...existing,
      similarity: existing.similarity ?? result.similarity,
      retrievalMethod: "both",
    });
  }

  return [...merged.values()].slice(0, MAX_RAG_SOURCES);
}
