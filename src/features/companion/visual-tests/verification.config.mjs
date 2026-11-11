import { join } from "node:path";

// Verification must not discover .env files or use real provider credentials.
export default {
  envDir: false,
  cacheDir: join(process.env.TMPDIR, "companion-vite-cache"),
  test: { env: { VITE_SUPABASE_URL: "http://127.0.0.1:1", VITE_SUPABASE_ANON_KEY: "synthetic-companion-verification-only" } },
};
