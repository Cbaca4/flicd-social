import { createClient } from "@supabase/supabase-js";
import { captureAuthScope } from "../app/authScope.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Operation clients share credentials, not Auth persistence. Both supported SDK
// hooks are needed: a token check and a final dispatch gate after its await.
export function createAccountClient(authScope) {
  const scope = captureAuthScope(authScope);
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => {
      scope.assertCurrent();
      const { data, error } = await supabase.auth.getSession();
      scope.assertCurrent();
      if (error) throw error;
      scope.assertSession(data?.session);
      if (!data.session.access_token) throw new Error("You must be logged in.");
      return data.session.access_token;
    },
    global: { fetch: (input, init) => {
      scope.assertCurrent();
      return fetch(input, init);
    } },
  });
}
