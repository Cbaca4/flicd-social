/**
 * Restore the approved beta MP3s into the isolated, non-production Supabase
 * staging project. Run only after the existing verified catalog seed exists:
 *
 * node --env-file=.env.gateway scripts/restore-staging-beta-music.mjs
 *
 * Keep service-role credentials in the ignored .env.gateway, never VITE_*.
 * The underlying upload script verifies every signed playback URL.
 */
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const STAGING_URL = 'https://ljcfoanzmowgkjtrdcgg.supabase.co';
const expectedFiles = [
  'the-road.mp3', 'the-road-2.mp3', 'that-feeling.mp3',
  'feeling.mp3', 'what-it-feels-like.mp3', 'good-feel.mp3',
  'no-limits.mp3', 'all-out.mp3', 'around-the-corner.mp3', 'this-life.mp3',
];

if (process.env.NODE_ENV === 'production') {
  throw new Error('This is a local staging restoration script, not a production workflow.');
}
if (process.env.FLICD_STAGING_SUPABASE_URL &&
    process.env.FLICD_STAGING_SUPABASE_URL !== STAGING_URL) {
  throw new Error('Refusing to restore music to a non-staging Supabase project.');
}
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== STAGING_URL) {
  throw new Error('Refusing to run while SUPABASE_URL points to a different project.');
}

const key = process.env.FLICD_STAGING_SERVICE_ROLE_KEY;
if (!key) {
  throw new Error('Missing FLICD_STAGING_SERVICE_ROLE_KEY in ignored .env.gateway.');
}
const musicDir = resolve(process.env.FLICD_MUSIC_DIR || './music-beta');
const missing = [];
for (const filename of expectedFiles) {
  try { await access(join(musicDir, filename)); }
  catch { missing.push(filename); }
}
if (missing.length) {
  throw new Error(
    'Missing approved beta MP3 files in ' + musicDir + ': ' + missing.join(', ') +
    '. Restore your original music-beta folder before uploading; no audio was changed.'
  );
}

// Explicitly bind the existing audited uploader to staging, regardless of
// shell defaults. Do not log the key or expose it to the browser.
process.env.SUPABASE_URL = STAGING_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;
process.env.FLICD_MUSIC_DIR = musicDir;
await import('./upload-beta-music.mjs');
