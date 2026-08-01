"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    const passwordStatus = new URLSearchParams(
      window.location.search,
    ).get("password");
    const messageTimer = window.setTimeout(() => {
      if (error === "confirmation") {
        setErrorMessage(
          "이메일 확인 링크가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
        );
      }
      if (passwordStatus === "updated") {
        setSuccessMessage(
          "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.",
        );
      }
    }, 0);

    return () => window.clearTimeout(messageTimer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage("Supabase 연결 설정을 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="다시 만나 반가워요"
      title="로그인"
      description="어디서든 내 SoriTarae 기록을 이어서 관리해 보세요."
      footer={
        <>
          아직 계정이 없나요? <Link href="/auth/signup">회원가입</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          이메일
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>

        <label>
          비밀번호
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
          />
        </label>

        <div className="auth-form-meta">
          <Link href="/auth/forgot-password">비밀번호를 잊으셨나요?</Link>
        </div>

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
          disabled={isSubmitting}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </AuthShell>
  );
}
