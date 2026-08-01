"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  );
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage("Supabase 연결 설정을 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
        "/auth/update-password",
      )}`,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    setSuccessMessage(
      "비밀번호 재설정 이메일을 보냈습니다. 받은 편지함을 확인해 주세요.",
    );
  }

  return (
    <AuthShell
      eyebrow="계정 복구"
      title="비밀번호 재설정"
      description="가입한 이메일로 안전한 비밀번호 변경 링크를 보내드려요."
      footer={<Link href="/auth/login">로그인으로 돌아가기</Link>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          가입한 이메일
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>

        {errorMessage && (
          <p className="auth-message is-error" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="auth-message is-success" role="status">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          className="primary-button auth-submit"
          disabled={isSubmitting || Boolean(successMessage)}
        >
          {isSubmitting ? "이메일 보내는 중..." : "재설정 이메일 보내기"}
        </button>
      </form>
    </AuthShell>
  );
}
