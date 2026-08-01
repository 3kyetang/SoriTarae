import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";

type RecoveryPageProps = {
  searchParams: Promise<{
    error?: string;
    token_hash?: string;
    type?: string;
  }>;
};

export default async function RecoveryPage({
  searchParams,
}: RecoveryPageProps) {
  const parameters = await searchParams;
  const tokenHash = parameters.token_hash;
  const isRecoveryLink = parameters.type === "recovery";
  const canContinue = Boolean(tokenHash && isRecoveryLink);

  return (
    <AuthShell
      eyebrow="계정 복구"
      title="비밀번호 재설정을 계속할까요?"
      description="이 버튼을 누를 때만 일회용 재설정 링크를 확인합니다."
      footer={<Link href="/auth/login">로그인으로 돌아가기</Link>}
    >
      {parameters.error === "invalid" && (
        <p className="auth-message is-error" role="alert">
          이메일 확인 링크가 만료되었거나 올바르지 않습니다. 새 이메일을
          요청해 주세요.
        </p>
      )}

      {!canContinue && parameters.error !== "invalid" && (
        <p className="auth-message is-error" role="alert">
          재설정 정보가 없습니다. 비밀번호 재설정 이메일을 다시 요청해
          주세요.
        </p>
      )}

      {canContinue && (
        <form
          className="auth-form"
          action="/auth/recovery/confirm"
          method="post"
        >
          <input type="hidden" name="token_hash" value={tokenHash} />
          <button type="submit" className="primary-button auth-submit">
            비밀번호 재설정 계속하기
          </button>
        </form>
      )}
    </AuthShell>
  );
}
