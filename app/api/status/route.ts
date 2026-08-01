import { GEMINI_MODEL } from "@/lib/gemini/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: GEMINI_MODEL,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
