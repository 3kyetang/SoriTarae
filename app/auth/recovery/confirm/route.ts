import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");

  if (typeof tokenHash !== "string" || !tokenHash) {
    return redirect(request, "/auth/recovery?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return redirect(request, "/auth/recovery?error=invalid");
  }

  return redirect(request, "/auth/update-password");
}
