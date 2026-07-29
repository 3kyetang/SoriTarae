import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && EMAIL_OTP_TYPES.has(value as EmailOtpType));
}

function safeRedirectUrl(request: NextRequest, path: string | null) {
  const fallback = new URL("/", request.nextUrl.origin);

  if (!path) return fallback;

  try {
    const candidate = new URL(path, request.nextUrl.origin);
    return candidate.origin === request.nextUrl.origin ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const requestedDestination = request.nextUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        safeRedirectUrl(request, requestedDestination),
      );
    }
  }

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const destination =
        type === "recovery"
          ? new URL("/auth/update-password", request.nextUrl.origin)
          : safeRedirectUrl(request, requestedDestination);
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=confirmation", request.nextUrl.origin),
  );
}
