import "server-only";

import { createHash } from "node:crypto";

const MAX_EMBEDDING_TEXT_LENGTH = 4_000;

export type EmbeddableDiary = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  transcript_summary: string | null;
  updated_at: string;
};

export function prepareDiaryEmbedding(diary: EmbeddableDiary) {
  const sections = [
    `제목: ${diary.title.trim()}`,
    `내용:\n${diary.body.trim()}`,
  ];
  const summary = diary.transcript_summary?.trim();
  if (summary) sections.push(`기록 요약:\n${summary}`);

  const content = sections.join("\n\n").slice(0, MAX_EMBEDDING_TEXT_LENGTH);
  const contentHash = createHash("sha256").update(content, "utf8").digest("hex");

  return {
    diaryId: diary.id,
    content,
    contentHash,
    updatedAt: diary.updated_at,
  };
}
