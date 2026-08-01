"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => (isSupabaseConfigured() ? createClient() : null),
    [],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < 8) {
      setErrorMessage("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("두 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!supabase) {
      setErrorMessage("Supabase 연결 설정을 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }

    setSuccessMessage(
      "확인 이메일을 보냈습니다. 이메일의 가입 확인 링크를 눌러 주세요.",
    );
  }

  return (
    <AuthShell
      eyebrow="나만의 기록 공간"
      title="회원가입"
      description="계정을 만들면 앞으로 작성할 일기를 안전하게 구분해 관리할 수 있어요."
      footer={
        <>
          이미 계정이 있나요? <Link href="/auth/login">로그인</Link>
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상 입력하세요"
            required
          />
        </label>

        <label>
          비밀번호 확인
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="비밀번호를 한 번 더 입력하세요"
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
          {isSubmitting ? "계정 만드는 중..." : "계정 만들기"}
        </button>
      </form>
    </AuthShell>
  );
}
