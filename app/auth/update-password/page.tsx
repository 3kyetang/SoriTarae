"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import {
  createPasswordRecoveryClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = useMemo(
    () =>
      supabaseConfigured ? createPasswordRecoveryClient() : null,
    [supabaseConfigured],
  );
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState(
    supabaseConfigured ? "" : "Supabase 연결 설정을 확인해 주세요.",
  );
  const [isCheckingSession, setIsCheckingSession] =
    useState(supabaseConfigured);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    let recoveryEventReceived = false;

    const finishSessionCheck = (hasSession: boolean) => {
      if (!isMounted) return;

      setHasRecoverySession(hasSession);
      setIsCheckingSession(false);

      if (hasSession) {
        setErrorMessage("");
      } else {
        const urlParameters = new URLSearchParams(
          window.location.hash.slice(1),
        );
        const providerError = urlParameters.get("error_description");
        setErrorMessage(
          providerError
            ? providerError
            : "이메일 확인 링크가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
        );
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryEventReceived = true;
        finishSessionCheck(Boolean(session?.user));
      }

      if (event === "INITIAL_SESSION" && !recoveryEventReceived) {
        finishSessionCheck(Boolean(session?.user));
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("새 비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("두 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!supabase || !hasRecoverySession) {
      setErrorMessage(
        "비밀번호 재설정 링크가 만료되었습니다. 이메일을 다시 요청해 주세요.",
      );
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    router.replace("/auth/login?password=updated");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="새로운 시작"
      title="새 비밀번호 설정"
      description="다른 서비스에서 사용하지 않는 안전한 비밀번호를 입력해 주세요."
      footer={
        hasRecoverySession ? (
          <Link href="/">SoriTarae 홈으로 이동</Link>
        ) : (
          <Link href="/auth/forgot-password">재설정 이메일 다시 받기</Link>
        )
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          새 비밀번호
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상 입력하세요"
            disabled={isCheckingSession || !hasRecoverySession}
            required
          />
        </label>

        <label>
          새 비밀번호 확인
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="새 비밀번호를 한 번 더 입력하세요"
            disabled={isCheckingSession || !hasRecoverySession}
            required
          />
        </label>

        {errorMessage && (
          <p className="auth-message is-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          className="primary-button auth-submit"
          disabled={
            isCheckingSession || !hasRecoverySession || isSubmitting
          }
        >
          {isCheckingSession
            ? "확인 중..."
            : isSubmitting
              ? "변경 중..."
              : "비밀번호 변경"}
        </button>
      </form>
    </AuthShell>
  );
}
