import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUSIC_DIR = path.resolve(process.env.FLICD_MUSIC_DIR || "./music-beta");
const BUCKET = "flicd-music";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell before running this script."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const files = [
  ["The Road", "the-road.mp3"],
  ["The Road 2", "the-road-2.mp3"],
  ["That Feeling", "that-feeling.mp3"],
  ["Feeling", "feeling.mp3"],
  ["What It Feels Like", "what-it-feels-like.mp3"],
  ["Good Feel", "good-feel.mp3"],
  ["No Limits", "no-limits.mp3"],
  ["All Out", "all-out.mp3"],
  ["Around the Corner", "around-the-corner.mp3"],
  ["This Life", "this-life.mp3"],
];

const { data: tracks, error: trackError } = await supabase
  .from("music_tracks")
  .select("id,title,artist,provider_track_id")
  .eq("provider", "Free Music Archive")
  .eq("active", true)
  .eq("approved", true);

if (trackError) throw trackError;

const byTitle = new Map((tracks || []).map((track) => [track.title, track]));
const missing = files.filter(([title]) => !byTitle.has(title));
if (missing.length) {
  throw new Error("Missing approved catalog tracks: " + missing.map(([title]) => title).join(", "));
}

for (const [title, filename] of files) {
  const track = byTitle.get(title);
  const localPath = path.join(MUSIC_DIR, filename);
  const objectPath = "beta/" + filename;

  const bytes = await fs.readFile(localPath);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) throw new Error(`Upload failed for ${title}: ${uploadError.message}`);

  const { error: updateError } = await supabase
    .from("music_tracks")
    .update({ audio_url: objectPath })
    .eq("id", track.id);

  if (updateError) throw new Error(`Database update failed for ${title}: ${updateError.message}`);

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, 60);

  if (signedError || !signed?.signedUrl) {
    throw new Error(`Signed URL verification failed for ${title}: ${signedError?.message || "no URL"}`);
  }

  console.log(`✓ ${title} -> ${objectPath}`);
}

console.log(`\nUploaded and verified ${files.length} beta music tracks.`);
