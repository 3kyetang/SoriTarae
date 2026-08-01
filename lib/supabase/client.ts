import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";

export { isSupabaseConfigured } from "./env";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();

  return createBrowserClient(
    url,
    publishableKey,
  );
}

// Password-recovery links are often opened by a mail app in a different
// browser from the one that requested them. Use the client-only implicit flow
// for this one-time operation so it does not depend on a PKCE verifier cookie
// stored in the requesting browser. The temporary session is kept in memory.
export function createPasswordRecoveryClient() {
  const { url, publishableKey } = getSupabasePublicEnv();

  return createSupabaseClient(url, publishableKey, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
