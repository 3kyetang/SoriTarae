import type { AuthError } from "@supabase/supabase-js";

const ERROR_MESSAGES: Record<string, string> = {
  email_address_invalid: "이메일 주소를 다시 확인해 주세요.",
  email_exists: "이미 가입된 이메일입니다. 로그인해 주세요.",
  email_not_confirmed: "이메일에서 가입 확인 링크를 먼저 눌러 주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  over_email_send_rate_limit:
    "이메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.",
  same_password: "기존 비밀번호와 다른 비밀번호를 입력해 주세요.",
  signup_disabled: "현재 새 회원가입이 비활성화되어 있습니다.",
  user_already_exists: "이미 가입된 이메일입니다. 로그인해 주세요.",
  weak_password: "더 안전한 비밀번호를 사용해 주세요.",
};

export function getAuthErrorMessage(error: AuthError | null) {
  if (!error) return "";
  return (
    ERROR_MESSAGES[error.code ?? ""] ??
    "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  );
}
