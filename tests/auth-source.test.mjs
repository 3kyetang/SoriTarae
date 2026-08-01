import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const login = await source("../app/auth/login/page.tsx");
const signup = await source("../app/auth/signup/page.tsx");
const forgotPassword = await source(
  "../app/auth/forgot-password/page.tsx",
);
const updatePassword = await source(
  "../app/auth/update-password/page.tsx",
);
const confirm = await source("../app/auth/confirm/route.ts");
const recovery = await source("../app/auth/recovery/page.tsx");
const confirmRecovery = await source(
  "../app/auth/recovery/confirm/route.ts",
);
const home = await source("../app/page.tsx");
const signupTemplate = await source(
  "../supabase/email-templates/confirm-signup.html",
);
const recoveryTemplate = await source(
  "../supabase/email-templates/reset-password.html",
);

test("implements the complete email and password auth flow", () => {
  assert.match(login, /auth\.signInWithPassword/);
  assert.match(signup, /auth\.signUp/);
  assert.match(signup, /emailRedirectTo/);
  assert.match(forgotPassword, /auth\.resetPasswordForEmail/);
  assert.match(updatePassword, /auth\.updateUser\(\{ password \}\)/);
  assert.match(home, /auth\.onAuthStateChange/);
  assert.match(home, /auth\.signOut\(\)/);
});

test("sends password recovery emails to a prefetch-safe landing page", () => {
  assert.match(
    forgotPassword,
    /redirectTo: `\$\{window\.location\.origin\}\/auth\/recovery`,/,
  );
  assert.match(recovery, /action="\/auth\/recovery\/confirm"/);
  assert.match(recovery, /method="post"/);
  assert.match(recovery, /name="token_hash"/);
  assert.doesNotMatch(recovery, /verifyOtp/);
  assert.match(confirmRecovery, /export async function POST/);
  assert.match(confirmRecovery, /auth\.verifyOtp/);
  assert.match(confirmRecovery, /type: "recovery"/);
  assert.match(confirmRecovery, /\/auth\/update-password/);
});

test("keeps the saving state active until diary embedding finishes", () => {
  const embeddingRequest = home.indexOf(
    "const embeddingReady = await requestDiaryEmbedding(savedEntry.id)",
  );
  const savingFinished = home.indexOf(
    "setIsSavingDiary(false)",
    embeddingRequest,
  );

  assert.ok(embeddingRequest >= 0);
  assert.ok(savingFinished > embeddingRequest);
  assert.match(home.slice(embeddingRequest, savingFinished), /finally/);
});

test("verifies email token hashes on the server without open redirects", () => {
  assert.match(confirm, /auth\.verifyOtp/);
  assert.match(confirm, /token_hash: tokenHash/);
  assert.match(confirm, /auth\.exchangeCodeForSession\(code\)/);
  assert.match(confirm, /candidate\.origin === request\.nextUrl\.origin/);
  assert.match(confirm, /type === "recovery"/);
  assert.doesNotMatch(confirm, /getSession\(/);
});

test("documents PKCE-compatible email template links", () => {
  assert.match(signupTemplate, /\{\{ \.RedirectTo \}\}/);
  assert.match(signupTemplate, /\{\{ \.TokenHash \}\}/);
  assert.match(signupTemplate, /type=email/);
  assert.match(recoveryTemplate, /\{\{ \.RedirectTo \}\}/);
  assert.match(recoveryTemplate, /\{\{ \.TokenHash \}\}/);
  assert.match(recoveryTemplate, /type=recovery/);
});
