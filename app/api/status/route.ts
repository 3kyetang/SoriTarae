export const runtime = "edge";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-3.6-flash";

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
