import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createEmbeddings } from "./client";
import {
  EmbeddableDiary,
  prepareDiaryEmbedding,
} from "./diary-content";
import { EMBEDDING_MODEL } from "./config";

export const MAX_DIARIES_PER_SYNC = 32;

type ExistingEmbedding = {
  diary_id: string;
  content_hash: string;
};

type DiaryVersion = {
  id: string;
  updated_at: string;
};

export type DiaryIndexResult = {
  indexed: number;
  upToDate: number;
  changedDuringIndexing: number;
  remaining: number;
};

export async function indexDiaries(
  supabase: SupabaseClient,
  diaries: EmbeddableDiary[],
): Promise<DiaryIndexResult> {
  if (!diaries.length) {
    return {
      indexed: 0,
      upToDate: 0,
      changedDuringIndexing: 0,
      remaining: 0,
    };
  }

  const prepared = diaries.map(prepareDiaryEmbedding);
  const diaryIds = prepared.map((diary) => diary.diaryId);
  const { data: existingData, error: existingError } = await supabase
    .from("diary_embeddings")
    .select("diary_id, content_hash")
    .in("diary_id", diaryIds);

  if (existingError) {
    throw new Error("Could not inspect existing diary embeddings.");
  }

  const existingHashes = new Map(
    ((existingData ?? []) as ExistingEmbedding[]).map((row) => [
      row.diary_id,
      row.content_hash,
    ]),
  );
  const candidates = prepared.filter(
    (diary) => existingHashes.get(diary.diaryId) !== diary.contentHash,
  );
  const selected = candidates.slice(0, MAX_DIARIES_PER_SYNC);

  if (!selected.length) {
    return {
      indexed: 0,
      upToDate: prepared.length,
      changedDuringIndexing: 0,
      remaining: 0,
    };
  }

  const vectors = await createEmbeddings(
    selected.map((diary) => diary.content),
  );

  const { data: latestData, error: latestError } = await supabase
    .from("diaries")
    .select("id, updated_at")
    .in(
      "id",
      selected.map((diary) => diary.diaryId),
    );

  if (latestError) {
    throw new Error("Could not verify diary versions after embedding.");
  }

  const latestVersions = new Map(
    ((latestData ?? []) as DiaryVersion[]).map((row) => [
      row.id,
      row.updated_at,
    ]),
  );
  const stableRows = selected.flatMap((diary, index) => {
    if (latestVersions.get(diary.diaryId) !== diary.updatedAt) return [];
    return [
      {
        diary_id: diary.diaryId,
        content: diary.content,
        content_hash: diary.contentHash,
        embedding: vectors[index],
        embedding_model: EMBEDDING_MODEL,
      },
    ];
  });

  if (stableRows.length) {
    const { error: upsertError } = await supabase
      .from("diary_embeddings")
      .upsert(stableRows, { onConflict: "diary_id" });

    if (upsertError) {
      throw new Error("Could not store diary embeddings.");
    }
  }

  return {
    indexed: stableRows.length,
    upToDate: prepared.length - candidates.length,
    changedDuringIndexing: selected.length - stableRows.length,
    remaining: candidates.length - selected.length,
  };
}
