# Multimodal Post Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact text, GIPHY GIF, voice, and up-to-15-second video replies to post conversations with persistent Supabase storage and graceful mobile behavior.

**Architecture:** Extend the existing `comments` row with typed media metadata while retaining the existing `text` column for backward compatibility. Isolate GIPHY behind a provider client, isolate audio/video validation and upload logic behind media helpers, and keep a single responsive `CommentComposer` plus type-specific comment renderers inside the existing Viewer conversation region.

**Tech Stack:** React, Vite, Vitest, Testing Library, Supabase Postgres/Storage, browser `MediaRecorder`, HTML media elements, GIPHY Search/Trending API.

**Spec:** `docs/superpowers/specs/2026-09-16-multimodal-comments-design.md`

## Global Constraints

- Text comments remain supported and remain limited to 500 characters.
- A comment can have only one attachment type: GIF, audio, or video.
- Voice replies are capped at 30 seconds.
- Video replies are capped at 15 seconds and longer files must never upload.
- GIF replies use GIPHY URLs/references and are not copied into Flic'd Storage.
- User-uploaded audio/video must live under the authenticated user's Storage namespace.
- Existing comment RLS visibility rules remain mandatory.
- Existing dump image validation remains unchanged.
- GIPHY API keys are never hard-coded; use `VITE_GIPHY_API_KEY`.
- The existing 83-test suite must remain green.
- Follow TDD: write and run a failing test before each production behavior change.

---

### Task 1: Extend the comments schema for typed media

**Files:**
- Create: `supabase/migrations/20260916170000_multimodal_comments.sql`
- Test: `supabase/migrations/20260916170000_multimodal_comments.test.sql` or the project's established SQL migration test location if one exists
- Reference: `supabase/migrations/20260916153409_persistent_social_interactions.sql`

**Interfaces:**
- Consumes: existing `public.comments` columns, RLS policies, and authenticated-user identity.
- Produces: nullable `media_type`, `media_url`, `media_path`, `media_metadata` fields plus a constraint that rejects empty text with no valid media.

- [ ] **Step 1: Write the failing schema test**

```sql
insert into public.comments (dump_id, user_id, text, media_type)
values ('00000000-0000-0000-0000-000000000001', auth.uid(), '', 'text');
```

Expected: the insert fails because a text comment needs non-empty text.

Add checks for each valid media type requiring its corresponding reference:

```sql
-- gif requires media_url
-- audio/video require media_path
```

- [ ] **Step 2: Run the project's SQL test command**

Use the repository's existing Supabase test command. Expected result before the migration: the new columns/constraint are unavailable or invalid rows are accepted.

- [ ] **Step 3: Add the migration**

```sql
alter table public.comments
  add column media_type text not null default 'text',
  add column media_url text,
  add column media_path text,
  add column media_metadata jsonb;

alter table public.comments
  add constraint comments_media_type_check
  check (media_type in ('text', 'gif', 'audio', 'video'));

alter table public.comments
  add constraint comments_content_check
  check (
    char_length(trim(text)) between 0 and 500
    and (
      char_length(trim(text)) > 0
      or (media_type = 'gif' and media_url is not null and trim(media_url) <> '')
      or (media_type in ('audio', 'video') and media_path is not null and trim(media_path) <> '')
    )
  );
```

Before applying this constraint, normalize any existing rows whose `text` is null to `''` if the current table permits null, then retain the existing 500-character rule. Preserve existing RLS policies and grant behavior.

- [ ] **Step 4: Add a SQL test for valid media and invalid combinations**

```sql
-- valid text
-- valid gif with URL
-- valid audio with path
-- valid video with path
-- invalid gif with only media_path
-- invalid audio with only media_url
-- invalid empty comment with no media
```

- [ ] **Step 5: Run the SQL tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916170000_multimodal_comments.sql supabase/migrations/20260916170000_multimodal_comments.test.sql
git commit -m "feat: support multimodal comment records"
```

---

### Task 2: Build media validation and Storage helpers

**Files:**
- Create: `src/features/social/commentMedia.js`
- Test: `src/features/social/commentMedia.test.js`
- Reference: `src/features/capture/mediaUpload.js`

**Interfaces:**
- Produces:
  - `COMMENT_MEDIA_BUCKET = 'flicd-media'`
  - `MAX_VOICE_DURATION_SECONDS = 30`
  - `MAX_VIDEO_DURATION_SECONDS = 15`
  - `validateCommentVideo(file, durationSeconds)`
  - `getSupportedRecorderMimeType(mediaRecorderCtor, candidates)`
  - `uploadCommentMedia(file, mediaType, userId, supabaseClient)`
  - `removeCommentMedia(path, supabaseClient)`

- [ ] **Step 1: Write failing validation tests**

```js
it('rejects video longer than 15 seconds', () => {
  expect(() => validateCommentVideo(videoFile, 15.01)).toThrow(/15 seconds/i);
});

it('accepts a video exactly 15 seconds long', () => {
  expect(validateCommentVideo(videoFile, 15).mediaType).toBe('video');
});

it('rejects unsupported video MIME types', () => {
  expect(() => validateCommentVideo(new File(['x'], 'clip.mov', { type: 'video/quicktime' }), 5))
    .toThrow(/video format/i);
});

it('selects the first supported MediaRecorder MIME type', () => {
  const ctor = { isTypeSupported: (mime) => mime === 'audio/webm;codecs=opus' };
  expect(getSupportedRecorderMimeType(ctor, ['audio/mp4', 'audio/webm;codecs=opus'])).toBe('audio/webm;codecs=opus');
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/commentMedia.test.js
```

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement validation/upload helpers**

```js
export const COMMENT_MEDIA_BUCKET = 'flicd-media';
export const MAX_VOICE_DURATION_SECONDS = 30;
export const MAX_VIDEO_DURATION_SECONDS = 15;
export const ALLOWED_COMMENT_VIDEO_TYPES = ['video/mp4', 'video/webm'];

export function validateCommentVideo(file, durationSeconds) {
  if (!file || !ALLOWED_COMMENT_VIDEO_TYPES.includes(file.type)) {
    throw new Error('Please choose an MP4 or WebM video.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Could not read the video duration.');
  }
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error('Video replies must be 15 seconds or shorter.');
  }
  return { mediaType: 'video', durationSeconds };
}

export function getSupportedRecorderMimeType(mediaRecorderCtor = globalThis.MediaRecorder, candidates = []) {
  if (!mediaRecorderCtor?.isTypeSupported) return '';
  return candidates.find((mime) => mediaRecorderCtor.isTypeSupported(mime)) || '';
}
```

For uploads, create a UUID-based user-scoped path such as `${userId}/comments/${mediaType}/${uuid}.${extension}` and call `.upload()` with `upsert: false`; return the Storage path, not a guessed URL.

- [ ] **Step 4: Test partial-upload cleanup**

Mock the Storage `.upload()` and `.remove()` functions and assert `removeCommentMedia()` receives the exact uploaded path after a later persistence failure.

- [ ] **Step 5: Verify**

```bash
npm run test -- src/features/social/commentMedia.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/social/commentMedia.js src/features/social/commentMedia.test.js
git commit -m "feat: add comment media validation and storage helpers"
```

---

### Task 3: Add GIPHY provider client and normalization

**Files:**
- Create: `src/features/social/giphyApi.js`
- Test: `src/features/social/giphyApi.test.js`
- Modify: `.env.example` if present; otherwise create `.env.example`

**Interfaces:**
- Produces:
  - `searchGifs(query, options)`
  - `getTrendingGifs(options)`
  - normalized result shape `{ id, title, previewUrl, fullUrl, width, height }`
  - `GIPHY_ATTRIBUTION_TEXT = 'Powered By GIPHY'`

- [ ] **Step 1: Write failing provider tests**

```js
it('normalizes GIPHY search results', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ id: '1', title: 'wave', images: { fixed_width: { url: 'https://giphy.test/preview.gif', width: '200', height: '150' }, original: { url: 'https://giphy.test/full.gif' } } }] }),
  });
  await expect(searchGifs('hello', { apiKey: 'test' })).resolves.toEqual([
    { id: '1', title: 'wave', previewUrl: 'https://giphy.test/preview.gif', fullUrl: 'https://giphy.test/full.gif', width: 200, height: 150 },
  ]);
});

it('encodes the query and requests a general-audience rating', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  await searchGifs('cat & dog', { apiKey: 'test', limit: 12 });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=cat%20%26%20dog'));
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('rating=pg-13'));
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/giphyApi.test.js
```

Expected: FAIL because the provider module does not exist.

- [ ] **Step 3: Implement the isolated client**

```js
const API_BASE = 'https://api.giphy.com/v1/gifs';
export const GIPHY_ATTRIBUTION_TEXT = 'Powered By GIPHY';

function getApiKey(explicitKey) {
  return explicitKey || import.meta.env.VITE_GIPHY_API_KEY || '';
}

function normalizeGif(item) {
  const preview = item?.images?.fixed_width;
  const original = item?.images?.original;
  if (!item?.id || !preview?.url || !original?.url) return null;
  return {
    id: item.id,
    title: item.title || '',
    previewUrl: preview.url,
    fullUrl: original.url,
    width: Number(preview.width) || 0,
    height: Number(preview.height) || 0,
  };
}

async function request(path, params, apiKey) {
  const key = getApiKey(apiKey);
  if (!key) throw new Error('GIPHY is not configured.');
  const url = new URL(`${API_BASE}/${path}`);
  url.search = new URLSearchParams({ api_key: key, rating: 'pg-13', ...params }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error('GIPHY could not load GIFs.');
  const payload = await response.json();
  return (payload.data || []).map(normalizeGif).filter(Boolean);
}

export function searchGifs(query, options = {}) {
  const clean = String(query || '').trim();
  return request('search', { q: clean, limit: String(options.limit || 18) }, options.apiKey);
}

export function getTrendingGifs(options = {}) {
  return request('trending', { limit: String(options.limit || 18) }, options.apiKey);
}
```

Keep the browser-visible API key in `.env.example` as:

```text
VITE_GIPHY_API_KEY=
```

Do not add a real key to the repository.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/social/giphyApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/social/giphyApi.js src/features/social/giphyApi.test.js .env.example
 git commit -m "feat: add GIPHY provider client"
```

---

### Task 4: Extend interactions API for normalized multimodal comments

**Files:**
- Modify: `src/features/social/interactionsApi.js`
- Test: `src/features/social/interactionsApi.comments.test.js`

**Interfaces:**
- Changes `addComment(dumpId, text)` to `addComment(dumpId, input)` where `input` can be a legacy string or `{ text, mediaType, mediaUrl, mediaPath, mediaMetadata }`.
- `hydrateDumpInteractions()` returns every comment with `media_type`, `media_url`, `media_path`, and `media_metadata` normalized to camelCase fields.

- [ ] **Step 1: Write failing tests**

```js
it('still accepts legacy text input', async () => {
  await addComment('dump-1', 'hello');
  expect(inserted.text).toBe('hello');
  expect(inserted.media_type).toBe('text');
});

it('inserts a GIF comment', async () => {
  await addComment('dump-1', {
    text: '',
    mediaType: 'gif',
    mediaUrl: 'https://giphy.test/x.gif',
    mediaMetadata: { provider: 'giphy', id: 'x' },
  });
  expect(inserted.media_type).toBe('gif');
  expect(inserted.media_url).toContain('giphy.test');
});
```

Add equivalent audio/video insertion validation and hydration assertions.

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/interactionsApi.comments.test.js
```

Expected: FAIL because `addComment` currently accepts only text and hydration returns text-only comments.

- [ ] **Step 3: Implement normalized input validation**

```js
const COMMENT_MEDIA_TYPES = new Set(['text', 'gif', 'audio', 'video']);

export async function addComment(dumpId, input) {
  const value = typeof input === 'string' ? { text: input, mediaType: 'text' } : (input || {});
  const text = String(value.text || '').trim();
  const mediaType = value.mediaType || 'text';
  if (!COMMENT_MEDIA_TYPES.has(mediaType)) throw new Error('Unsupported comment media type');
  if (text.length > 500) throw new Error('Comment must be 500 characters or fewer');
  const hasMedia = mediaType !== 'text' && Boolean(value.mediaUrl || value.mediaPath);
  if (!text && !hasMedia) throw new Error('Comment cannot be empty');
  if (mediaType === 'gif' && !value.mediaUrl) throw new Error('GIF comment is missing its media URL');
  if ((mediaType === 'audio' || mediaType === 'video') && !value.mediaPath) throw new Error('Comment media is missing its Storage path');

  const { data, error } = await supabase.from('comments').insert({
    dump_id: dumpId,
    user_id: userId,
    text,
    media_type: mediaType,
    media_url: value.mediaUrl || null,
    media_path: value.mediaPath || null,
    media_metadata: value.mediaMetadata || null,
  }).select('*').single();
  if (error) throw error;
  return normalizeComment(data);
}
```

Define one `normalizeComment(row)` helper used by both insert and hydration.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/social/interactionsApi.comments.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/social/interactionsApi.js src/features/social/interactionsApi.comments.test.js
 git commit -m "feat: persist typed comment media"
```

---

### Task 5: Build the responsive GIF picker

**Files:**
- Create: `src/features/social/GifPicker.jsx`
- Create: `src/features/social/GifPicker.css`
- Test: `src/features/social/GifPicker.test.jsx`

**Interfaces:**
- Consumes: `onSelect(gif)`, `onClose()`.
- Produces: selected normalized GIPHY result.

- [ ] **Step 1: Write failing UI tests**

```jsx
it('loads trending GIFs when opened', async () => {
  render(<GifPicker onSelect={() => {}} onClose={() => {}} />);
  expect(await screen.findByTestId('giphy-result-1')).toBeInTheDocument();
  expect(screen.getByText('Powered By GIPHY')).toBeInTheDocument();
});

it('searches after entering a query', async () => {
  const user = userEvent.setup();
  render(<GifPicker ... />);
  await user.type(screen.getByRole('searchbox', { name: /search gifs/i }), 'cats');
  await user.keyboard('{Enter}');
  expect(searchGifs).toHaveBeenCalledWith('cats', expect.any(Object));
});

it('passes a selected GIF to the composer', async () => {
  const onSelect = vi.fn();
  // click the first result
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'gif' }));
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/GifPicker.test.jsx
```

Expected: FAIL because the picker does not exist.

- [ ] **Step 3: Implement a mobile-first sheet**

Structure:

```jsx
<div className="comment-media-sheet" role="dialog" aria-modal="true" aria-label="Choose a GIF">
  <div className="comment-media-sheet__header">...</div>
  <input role="searchbox" aria-label="Search GIFs" />
  <div className="gif-grid">...</div>
  <div className="giphy-attribution">Powered By GIPHY</div>
</div>
```

Use 2 columns below 500px and 3 columns above it. Each image gets a fixed aspect-ratio tile and `object-fit: cover`.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/social/GifPicker.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/social/GifPicker.jsx src/features/social/GifPicker.css src/features/social/GifPicker.test.jsx
 git commit -m "feat: add responsive GIPHY picker"
```

---

### Task 6: Build voice recording state machine

**Files:**
- Create: `src/features/social/VoiceRecorder.jsx`
- Test: `src/features/social/VoiceRecorder.test.jsx`

**Interfaces:**
- Produces `onReady({ blob, durationSeconds, mimeType })` after review confirmation.
- States: `idle`, `recording`, `review`, `unsupported`, `error`.

- [ ] **Step 1: Write failing tests**

```jsx
it('starts and stops recording using MediaRecorder', async () => {
  // provide a fake MediaRecorder with start/stop/ondataavailable/onstop
  render(<VoiceRecorder onReady={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /record voice/i }));
  expect(screen.getByText(/recording/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /stop recording/i }));
  expect(screen.getByRole('button', { name: /send recording/i })).toBeInTheDocument();
});

it('auto-stops at 30 seconds', () => {
  // use fake timers and assert MediaRecorder.stop called at 30000ms
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/VoiceRecorder.test.jsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the state machine**

Use `navigator.mediaDevices.getUserMedia({ audio: true })`; pick a supported MIME type; collect chunks; create a Blob on stop; expose replay and discard controls; automatically stop after 30 seconds.

Unsupported browsers and permission denial must set an inline error rather than throwing into the page.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/social/VoiceRecorder.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/social/VoiceRecorder.jsx src/features/social/VoiceRecorder.test.jsx
 git commit -m "feat: add voice comment recording"
```

---

### Task 7: Build video reply picker and 15-second duration gate

**Files:**
- Create: `src/features/social/VideoReplyPicker.jsx`
- Test: `src/features/social/VideoReplyPicker.test.jsx`

**Interfaces:**
- Produces `onReady({ file, durationSeconds, mimeType })` only when duration is `<= 15` seconds.

- [ ] **Step 1: Write failing tests**

```jsx
it('rejects a 15.01 second video before upload', async () => {
  // mock metadata loading as 15.01 seconds
  await user.upload(input, videoFile);
  expect(screen.getByRole('alert')).toHaveTextContent(/15 seconds/i);
  expect(onReady).not.toHaveBeenCalled();
});

it('accepts a 15 second video and shows a preview', async () => {
  // metadata duration 15
  await user.upload(input, videoFile);
  expect(screen.getByTestId('video-reply-preview')).toBeInTheDocument();
  expect(screen.getByText('15s')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/VideoReplyPicker.test.jsx
```

Expected: FAIL because the picker does not exist.

- [ ] **Step 3: Implement file/camera selection and metadata validation**

Use an off-DOM `<video preload="metadata">` to read `duration`. Accept `video/mp4` and `video/webm`, validate duration before calling `onReady`, and never call the upload callback for rejected files.

Render a compact preview with a duration badge and Remove control.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/social/VideoReplyPicker.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/social/VideoReplyPicker.jsx src/features/social/VideoReplyPicker.test.jsx
 git commit -m "feat: add 15 second video comment picker"
```

---

### Task 8: Build the single responsive CommentComposer

**Files:**
- Create: `src/features/social/CommentComposer.jsx`
- Create: `src/features/social/CommentComposer.css`
- Test: `src/features/social/CommentComposer.test.jsx`

**Interfaces:**
- Props: `dumpId`, `onCommentCreated`, optional `currentUserId`.
- Produces normalized persisted comment objects through `onCommentCreated(comment)`.

- [ ] **Step 1: Write failing composer tests**

```jsx
it('renders text, GIF, Voice, Video, and Send controls', () => {
  render(<CommentComposer dumpId="d1" onCommentCreated={() => {}} />);
  expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /gif/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /voice/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /video/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
});

it('only enables Send for text or a ready attachment', async () => {
  render(...);
  expect(sendButton).toBeDisabled();
  await user.type(textbox, 'hello');
  expect(sendButton).not.toBeDisabled();
});

it('requires replacement confirmation when switching attachment types', async () => {
  // select GIF, then choose Voice; expect discard confirmation
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/social/CommentComposer.test.jsx
```

Expected: FAIL because the composer does not exist.

- [ ] **Step 3: Implement composer state**

Use:

```js
const [text, setText] = React.useState('');
const [attachment, setAttachment] = React.useState(null);
const [pendingMode, setPendingMode] = React.useState(null);
const [sending, setSending] = React.useState(false);
const [error, setError] = React.useState('');
```

The attachment shape is:

```js
{
  mediaType: 'gif' | 'audio' | 'video',
  mediaUrl: string | null,
  file: File | Blob | null,
  mediaMetadata: object,
}
```

On Send:

```js
let uploadedPath = null;
try {
  setSending(true);
  if (attachment?.file) {
    uploadedPath = await uploadCommentMedia(attachment.file, attachment.mediaType, currentUserId);
  }
  const saved = await addComment(dumpId, {
    text,
    mediaType: attachment?.mediaType || 'text',
    mediaUrl: attachment?.mediaUrl || null,
    mediaPath: uploadedPath,
    mediaMetadata: attachment?.mediaMetadata || null,
  });
  onCommentCreated(saved);
  setText('');
  setAttachment(null);
} catch (sendError) {
  if (uploadedPath) await removeCommentMedia(uploadedPath);
  setError(sendError.message || 'Could not send reply.');
} finally {
  setSending(false);
}
```

Keep text and attachment in state after a failed send so Retry is possible.

- [ ] **Step 4: Style the composer responsively**

```css
.comment-composer {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.comment-composer__row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.comment-composer__input { flex: 1 1 auto; min-width: 0; }
.comment-composer__actions { display: flex; flex-wrap: wrap; gap: 6px; }
.comment-attachment-preview { min-width: 0; max-width: 260px; }
@media (max-width: 620px) {
  .comment-composer__row { align-items: stretch; flex-direction: column; }
  .comment-composer__actions { width: 100%; }
  .comment-composer__actions .btn { flex: 1 1 72px; }
}
```

Do not create a second full-height scroll container.

- [ ] **Step 5: Verify**

```bash
npm run test -- src/features/social/CommentComposer.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/social/CommentComposer.jsx src/features/social/CommentComposer.css src/features/social/CommentComposer.test.jsx
 git commit -m "feat: add responsive multimodal comment composer"
```

---

### Task 9: Render multimodal comments compactly in the post viewer

**Files:**
- Modify: `src/features/home/Home.jsx`
- Test: `src/features/home/Home.multimodal-comments.test.jsx`

**Interfaces:**
- Consumes: normalized comments from hydration and `CommentComposer` callbacks.
- Produces: type-specific compact rows for text/GIF/audio/video and object-safe fallback rendering.

- [ ] **Step 1: Write failing tests**

```jsx
it('renders text, GIF, audio, and video comments without treating media as text', () => {
  render(<Viewer post={{ ...samplePost, comments: [
    { id: 't', from: 'a', text: 'hello', mediaType: 'text' },
    { id: 'g', from: 'b', text: '', mediaType: 'gif', mediaUrl: 'https://giphy.test/x.gif' },
    { id: 'a', from: 'c', text: '', mediaType: 'audio', mediaPath: 'c/comments/audio/a.webm' },
    { id: 'v', from: 'd', text: '', mediaType: 'video', mediaPath: 'd/comments/video/v.mp4' },
  ] }} ... />);
  expect(screen.getByText('hello')).toBeInTheDocument();
  expect(screen.getByTestId('comment-gif-g')).toBeInTheDocument();
  expect(screen.getByTestId('comment-audio-a')).toBeInTheDocument();
  expect(screen.getByTestId('comment-video-v')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/home/Home.multimodal-comments.test.jsx
```

Expected: FAIL because Viewer currently renders every comment as text.

- [ ] **Step 3: Implement dedicated renderers**

Use a small helper component:

```jsx
function CommentItem({ comment }) {
  return (
    <article className="comment-item">
      <div className="comment-item__author">@{comment.from}</div>
      {comment.mediaType === 'gif' && <img data-testid={`comment-gif-${comment.id}`} className="comment-gif" src={comment.mediaUrl} alt={comment.text || 'GIF reply'} />}
      {comment.mediaType === 'audio' && <audio data-testid={`comment-audio-${comment.id}`} className="comment-audio" controls preload="metadata" src={comment.mediaUrl} />}
      {comment.mediaType === 'video' && <video data-testid={`comment-video-${comment.id}`} className="comment-video" controls preload="metadata" src={comment.mediaUrl} />}
      {comment.text && <p className="subtitle">{comment.text}</p>}
    </article>
  );
}
```

For private Storage paths, resolve a signed/public URL through a helper before rendering instead of passing a raw path to the browser. Do not expose an arbitrary path as a URL.

- [ ] **Step 4: Verify and style**

Add CSS:

```css
.comment-item { display: grid; gap: 5px; min-width: 0; }
.comment-gif { width: min(100%, 240px); max-height: 180px; object-fit: cover; border-radius: 14px; display: block; }
.comment-audio { width: min(100%, 300px); height: 40px; }
.comment-video { width: min(100%, 280px); max-height: 220px; border-radius: 14px; display: block; object-fit: cover; background: #111; }
```

- [ ] **Step 5: Commit**

```bash
git add src/features/home/Home.jsx src/features/home/Home.multimodal-comments.test.jsx src/styles.css
 git commit -m "feat: render multimodal post comments"
```

---

### Task 10: Connect Viewer, parent state, and interaction cleanup

**Files:**
- Modify: `src/features/home/Home.jsx`, `src/app/FlicdApp.jsx`
- Test: `src/app/FlicdApp.comments.test.jsx`

**Interfaces:**
- `Viewer` emits `onCommentCreated(comment)` rather than raw text.
- Parent app appends the exact normalized comment returned from `addComment()` without re-querying the entire feed.
- Failed user-media sends clean up uploaded Storage files.

- [ ] **Step 1: Write failing tests**

```jsx
it('appends a persisted multimodal comment to the active post', async () => {
  const comment = { id: 'gif-1', from: 'you', mediaType: 'gif', mediaUrl: 'https://giphy.test/g.gif', text: '' };
  // render active viewer, invoke callback, assert comment appears exactly once
});

it('removes uploaded media when addComment fails', async () => {
  // upload resolves to a path; addComment rejects; assert removeCommentMedia(path)
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/app/FlicdApp.comments.test.jsx
```

Expected: FAIL because parent wiring still uses `comment(id, text)`.

- [ ] **Step 3: Implement normalized parent callback**

Replace the parent callback shape with:

```jsx
const handleCommentCreated = (comment) => {
  setDumps((currentDumps) => currentDumps.map((post) =>
    post.id === activePostId
      ? { ...post, comments: [...post.comments, comment] }
      : post,
  ));
};
```

Pass `onCommentCreated={handleCommentCreated}` into Viewer.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/app/FlicdApp.comments.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/Home.jsx src/app/FlicdApp.jsx src/app/FlicdApp.comments.test.jsx
 git commit -m "feat: connect persisted multimodal comments"
```

---

### Task 11: Add Storage/RLS policy coverage for comment media

**Files:**
- Create: `supabase/migrations/20260916171000_comment_media_storage_policies.sql`
- Test: the project's established Supabase SQL policy test location

**Interfaces:**
- Consumes: `flicd-media` bucket and authenticated user IDs.
- Produces: policies allowing authenticated users to insert/delete only their own `comments/audio/*` and `comments/video/*` objects while read access follows the application's visible-comment/post rules.

- [ ] **Step 1: Write failing policy tests**

Test the following identities separately:

```sql
-- user A can insert user A audio path
-- user A cannot insert user B audio path
-- user A can delete user A path
-- user A cannot delete user B path
-- a user cannot access media for a dump they cannot view
```

- [ ] **Step 2: Run the policy tests and verify failure**

Expected: FAIL because no typed comment-media policy exists yet.

- [ ] **Step 3: Add exact path-prefix Storage policies**

Use the authenticated user UUID as the first path segment and restrict object names to `comments/audio/` or `comments/video/`. Do not create a policy permitting arbitrary paths in the bucket.

- [ ] **Step 4: Verify**

Run the existing SQL test command and expect PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916171000_comment_media_storage_policies.sql
 git commit -m "security: restrict comment media storage paths"
```

---

### Task 12: Full multimodal regression and mobile acceptance suite

**Files:**
- Modify existing tests only where required for shared mocks/setup.
- Test: all new social/comment tests plus existing Home/Capture/Companion/Profile suites.

- [ ] **Step 1: Run focused tests**

```bash
npm run test -- src/features/social src/features/home src/features/capture src/app
```

Expected: PASS.

- [ ] **Step 2: Run the full suite**

```bash
npm run test
```

Expected: all tests pass and the total is greater than the existing **83** tests.

- [ ] **Step 3: Manual phone verification**

Use the real phone test method already used for Flic'd and verify:

```text
Home → post → comments
Text reply
GIF search → select → send
Voice → record → review → send
Video → select/camera → 15.0s accepted
Video → 15.01s rejected
Keyboard does not hide composer
Bottom dock does not overlap composer
Portrait and landscape both remain usable
```

- [ ] **Step 4: Verify failure states manually**

Test GIPHY unavailable, microphone denied, camera denied, oversized/invalid video, upload failure, and database failure. Confirm text/attachment remains available after a send failure.

- [ ] **Step 5: Final commit**

```bash
git status
git log -8 --oneline
```

Expected: working tree clean and the feature commits present on `feature/companion-autonomous-motion`.
