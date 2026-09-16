# Multimodal Post Comments Design

## Goal

Extend Flic post replies from text-only comments to four compact reply modes: text, GIPHY GIFs, recorded voice clips, and user-recorded/uploaded videos up to 15 seconds, while preserving the current post conversation and mobile visual language.

## Current state

The current `comments` table stores only `text`, `dump_id`, `user_id`, and `created_at`. The social API inserts and hydrates text comments. The post viewer renders a chronological text list followed by a one-line text input and Send button. Supabase Storage currently accepts image/jpeg, image/png, and image/webp for dump media.

## Design

### Comment record

Extend `public.comments` with nullable multimodal fields while keeping `text` for backward compatibility:

- `media_type`: `text`, `gif`, `audio`, or `video`;
- `media_url`: nullable public/signed URL or GIPHY asset URL/reference;
- `media_path`: nullable Supabase Storage path for user-uploaded audio/video;
- `media_metadata`: nullable JSONB containing provider/media identifiers and client-captured metadata such as duration and MIME type.

Text-only rows remain valid. A multimodal row may have empty `text` only when it has a valid media attachment.

The database check constraint will enforce that a comment contains either non-empty text or a supported media type with a corresponding media reference. The maximum text length remains 500 characters.

### GIF provider

Use the GIPHY API through a dedicated client module. The web integration will use the GIPHY Search and Trending endpoints, with URL-encoded queries, a content-rating setting appropriate for a general-audience social app, and small result limits. GIPHY requires client-side Search calls and conspicuous "Powered By GIPHY" attribution where the API is used. citeturn255318search0turn255318search1turn255318search3

Configuration will use a frontend environment variable such as `VITE_GIPHY_API_KEY`; the key must never be hard-coded into source control. Because GIPHY's Search API is intended for client-side use, this is an API identifier rather than a server secret. A separate provider module isolates API response shapes from the React UI.

The GIF picker will open as an app-native bottom sheet/modal. It will show Trending results initially, search results after a query, a compact search field, a responsive grid, loading/error states, and the required GIPHY attribution. Selecting a GIF closes the picker and places a small attachment preview in the composer until Send or Remove is chosen.

GIPHY analytics/action registration will be included for view/select/send actions where the provider's current API permits it. citeturn255318search0

### Voice replies

Use the browser `MediaRecorder` API. The voice composer has states `idle`, `recording`, `review`, and `sending`.

- Start creates an audio recording using a supported browser MIME type.
- Stop creates a local Blob and an in-browser preview.
- The user can replay or discard before sending.
- The uploaded object is stored in the existing `flicd-media` bucket under the authenticated user's namespace, with an `audio/*` content type.
- Recordings are capped at 30 seconds to prevent accidental long uploads; the UI shows elapsed time and automatically stops at the cap.

Unsupported recording browsers receive an inline "Voice replies aren't supported here" state instead of a broken control.

### Video replies

Use the phone camera/file picker and browser media metadata to enforce a 15-second maximum before upload.

- Accepted video types are common browser/mobile formats, including MP4 and WebM where supported.
- The selected video is loaded into a temporary `<video>` element to read duration before send.
- Videos longer than 15 seconds are rejected with a clear message and are never uploaded.
- A valid clip gets a local preview with a small duration badge and discard control.
- Uploaded videos use the same user-scoped Storage namespace as voice replies.

The 15-second limit is a product validation rule; server/database data also stores the measured duration in `media_metadata` so clients can render the same limit consistently.

### Media storage and rendering

User-uploaded audio/video is stored in Supabase Storage. GIF replies reference GIPHY media rather than duplicating provider media into Flic'd storage.

Comment rendering is type-specific but intentionally compact:

- text: normal comment row;
- GIF: rounded media tile constrained to a small maximum width/height;
- audio: compact bubble with play/pause, duration, and progress;
- video: rounded thumbnail/player capped in height, with native controls and a 15-second badge.

No media comment becomes a full-width social post inside the comment thread. Tapping a media item may open a lightweight viewer/expanded playback state only when necessary.

### Composer interaction

The composer is one responsive component with these controls:

`input` + `GIF` + `Voice` + `Video` + `Send`

On small screens the action controls wrap beneath the input rather than shrinking the input below a usable size. An active attachment preview occupies one compact row above the controls. The Send button is disabled unless there is text or a ready attachment.

Only one attachment type may be pending at once. Selecting a new type while an attachment exists prompts the user to discard the current attachment before replacing it. This avoids an overcomplicated multi-attachment composer.

The composer remains above the app bottom dock and respects safe-area padding. The post viewer's scroll container remains the owner of page scrolling; the composer does not create a second full-height scroll area.

### Persistence API

`interactionsApi.js` will expose a normalized creation function, for example:

```js
addComment(dumpId, {
  text,
  mediaType,
  mediaUrl,
  mediaPath,
  mediaMetadata,
})
```

The API validates the input before inserting and returns the persisted row. `hydrateDumpInteractions()` returns normalized comment objects regardless of media type.

### Security and RLS

Existing comment RLS rules continue to require the authenticated user to be the inserted `user_id` and to be allowed to see the target dump. Storage policies for audio/video must similarly restrict upload/delete paths to the authenticated user's namespace and read access to media attached to visible comments/posts.

A comment must not be allowed to reference arbitrary third-party storage paths as if the user owned them. GIPHY URLs are permitted only for `media_type = gif`, and user-uploaded paths are permitted only for `audio` or `video`.

### Error handling

Provider errors, denied microphone/camera permissions, unsupported browser recording, invalid video duration, failed Storage uploads, failed database inserts, and failed comment reads each have a distinct inline UI state. Failed uploads remove partially created Storage objects. A failed send keeps the user's text/attachment available for retry.

### Testing requirements

Add failing tests before production changes for:

- text comments still persisting;
- GIF provider search/trending normalization;
- GIF selection and attribution rendering;
- voice recording state transitions and duration cap;
- video duration validation at 15 seconds;
- invalid media rejection;
- comment insertion for each media type;
- multimodal comment hydration and rendering;
- composer responsiveness/accessible controls;
- Storage cleanup when comment persistence fails;
- RLS/storage policy expectations through SQL migration tests where the project's existing testing approach supports them.

The existing 83-test suite must remain green.

## Non-goals

No GIF uploading by users, no multi-attachment comments, no live video replies, no video editing/cropping UI, no long-form audio, no stickers separate from GIFs, and no replacement of the existing GIPHY provider with another service in this pass.

## Acceptance criteria

A user can reply to a post with text, search/select a GIPHY GIF, record and send a voice clip, or record/select a video no longer than 15 seconds. Each reply persists correctly, renders compactly in the existing conversation UI, works on small and large phones in portrait and landscape, and fails gracefully when permissions, provider requests, media validation, Storage, or database operations fail.
