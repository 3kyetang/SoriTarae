function isHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function isUsablePublishableKey(value: string | undefined) {
  return Boolean(
    value &&
      value !== "your_supabase_publishable_key" &&
      !/\s/.test(value),
  );
}

export function isSupabaseConfigured() {
  return (
    isHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isUsablePublishableKey(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    )
  );
}

export function getSupabasePublicEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase public environment variables are missing or invalid.",
    );
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
