import { z } from "zod";

import type { EmbeddableDiary } from "@/lib/embeddings/diary-content";
import { indexDiaries } from "@/lib/embeddings/diary-indexing";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const paramsSchema = z.object({
  diaryId: z.string().uuid(),
});

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function POST(
  _request: Request,
  context: { params: Promise<{ diaryId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return Response.json(
      { error: "Invalid diary identifier." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const { data, error } = await supabase
    .from("diaries")
    .select("id, user_id, title, body, transcript_summary, updated_at")
    .eq("id", parsedParams.data.diaryId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Could not load the diary." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
  if (!data) {
    return Response.json(
      { error: "Diary not found." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await indexDiaries(supabase, [data as EmbeddableDiary]);
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { error: "Diary search preparation failed." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
