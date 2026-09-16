# Feed, Capture, and Post Interaction Design

## Goal

Turn the existing Flic feed, dump/roll publishing flow, post viewer, likes, comments entry point, and Keep action into a reliable mobile-first social loop without replacing the established visual language or the already-passing Profile/Companion work.

## Current state

The current Home screen filters loaded dumps by active space and renders each post as a large card. Opening a post enters a viewer with item navigation, Like, Keep, comments, and a text comment composer. Dump and Roll builders already upload image media through Supabase Storage and persist the resulting dump records. Likes and text comments are persisted through Supabase and hydrated when the feed loads.

Concrete gaps found in the current implementation:

- Feed loading and feed failure both collapse to an empty list, so an actual network/database failure can look like "Nothing here yet."
- The post viewer is visually dense on small screens because media, item controls, interaction controls, comments, and the composer share one card without a dedicated mobile interaction section.
- Likes are updated optimistically, but comment creation is not optimistic and has no inline pending state.
- The current feed model hydrates all interaction data at once and does not distinguish an interaction-hydration failure from an empty interaction set.
- Dump and Roll builders have useful validation and upload cleanup, but posting states and cancellation are not presented consistently across the two flows.
- The current Home card is a single large button, which makes the whole card clickable but leaves future interaction affordances constrained by the button container.

## Design

### Feed state model

Home will distinguish `loading`, `ready`, and `error` states. Loading uses a small set of app-native skeleton cards. Error uses the existing EmptyState visual language with a retry action. Ready with zero visible posts keeps the current empty state copy.

Feed loading will remain driven by the existing `getFeedDumps()` and `hydrateDumpInteractions()` APIs. No new feed backend is required for this pass.

### Post card and viewer

The post card remains visually recognizable, but its interactive structure will be decomposed into a semantic card shell plus a click target for opening the post. The media preview, author/context metadata, expiry indicator, like count, and comment count keep the current hierarchy.

The viewer will use three visual groups:

1. media and item navigation;
2. post actions (`Like`, `Keep`);
3. conversation, including the multimodal comment composer from the companion specification.

On narrow screens, the conversation group becomes a full-width stacked section. The composer must remain visible without overlapping the bottom dock and must remain usable with the on-screen keyboard.

### Likes

Keep the current optimistic like/unlike behavior. Add a disabled/pending state only for the active button while its request is in flight so repeated taps cannot enqueue inconsistent state changes. Existing rollback-on-error behavior remains mandatory.

### Comments entry point

Text comments continue to work exactly as today. The viewer will delegate creation/rendering of all comment types to the multimodal comment UI, which owns its own composer state and attachment preview. The outer viewer continues to own the post ID and receives a normalized callback such as `onCommentCreated(comment)`.

### Capture and publishing

Keep the existing Dump and Roll concepts. Do not merge them into one builder. Improve consistency so both builders:

- show a clear disabled/loading state while uploading;
- preserve the selected content while an upload is in progress;
- surface upload failure inline;
- clean up any partially uploaded Storage objects if database creation fails;
- return to Home only after database persistence succeeds.

Existing image validation limits remain unchanged: JPEG, PNG, and WebP; 10 MB maximum per image; 20 images maximum for Dump. Roll frame limits remain 8, 12, or 24.

### Mobile presentation

All changes use the existing `.screen`, `.card`, `.stack`, `.row`, `.wrap`, `.btn`, `.input`, and `.bottom-dock` language. No new floating panel system will be introduced. Conversation media gets constrained dimensions and `object-fit: cover` so GIFs and videos do not stretch the viewer vertically.

## Data and API boundaries

The feed/capture pass will not add new tables. Existing dump, dump_items, likes, comments, and Storage APIs remain the persistence boundary. New multimodal comment persistence is specified separately.

## Error handling

Feed errors are explicit and retryable. Like failures roll back. Comment send failures preserve the composer attachment/text and display an inline error. Upload failures clear only the pending upload state; they do not silently discard the user's selected media.

## Testing requirements

Add failing tests before production changes for:

- Home loading state;
- Home error state plus retry;
- viewer separation of actions and conversation;
- optimistic like pending/rollback behavior;
- Dump and Roll upload disabled states and cleanup paths;
- mobile-safe rendering of the interaction area.

The existing 83-test baseline must remain green after the pass.

## Non-goals

No ranking algorithm changes, no new recommendation system, no Stories subsystem, no direct-message changes, no Profile/Companion redesign, and no replacement of Supabase Storage with another media backend.

## Acceptance criteria

A user can load Home and tell loading, empty, and error states apart; open a post and interact with it on a phone without cramped controls; like/unlike reliably; enter the conversation area; publish a Dump or Roll with clear upload feedback; and reach the multimodal comment composer without the bottom dock or keyboard obscuring it.
