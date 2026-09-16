# Feed, Capture, and Post Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing Home feed, post viewer, likes, Dump, and Roll flows so users can distinguish loading/empty/error states, interact reliably on phones, and publish with consistent upload feedback without changing the established Flic visual language.

**Architecture:** Keep `getFeedDumps()` and `hydrateDumpInteractions()` as the existing feed boundary and keep Dump/Roll as separate builders. Move viewer UI toward semantic card/action/conversation sections while allowing the multimodal comment component to own comment composition; keep Supabase persistence and Storage as the existing backend boundaries.

**Tech Stack:** React, Vite, Vitest, Testing Library, Supabase client, existing Flic CSS primitives (`screen`, `card`, `stack`, `row`, `wrap`, `btn`, `input`, `bottom-dock`).

**Spec:** `docs/superpowers/specs/2026-09-16-feed-capture-interactions-design.md`

## Global Constraints

- Preserve the existing Profile and Companion behavior; do not redesign or rewrite either subsystem.
- Keep existing image validation: JPEG, PNG, WebP; 10 MB maximum per image; 20 images maximum for Dump.
- Keep Roll frame choices at 8, 12, and 24.
- Do not add feed ranking, Stories, direct-message, or alternate media-backend work.
- The existing 83-test suite must remain green.
- Follow TDD: each production change gets a failing regression test first.

---

### Task 1: Establish Home loading/error state coverage

**Files:**
- Modify: `src/features/home/Home.jsx`
- Test: `src/features/home/Home.test.jsx` (extend the existing Home test file if present; otherwise create it)
- Reference: `src/features/capture/dumpApi.js`
- Reference: `src/components/shared/States.jsx`

**Interfaces:**
- Consumes: `dumps`, `activeSpace`, `onOpen`, `onUserSelect` props and `getFeedDumps()` through the parent.
- Produces: Home UI that accepts explicit `loading` and `error` state props while preserving the existing zero-post EmptyState.

- [ ] **Step 1: Write the failing tests**

```jsx
it('renders a loading skeleton while the feed is loading', () => {
  render(<Home dumps={[]} activeSpace={space} loading onOpen={() => {}} />);
  expect(screen.getAllByTestId('feed-skeleton').length).toBeGreaterThan(0);
});

it('renders retryable feed error instead of an empty-state message', () => {
  const retry = vi.fn();
  render(<Home dumps={[]} activeSpace={space} loading={false} error="Failed to load social feed." onRetry={retry} onOpen={() => {}} />);
  expect(screen.getByText('Could not load your feed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  expect(retry).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
npm run test -- src/features/home/Home.test.jsx
```

Expected: the new tests fail because Home has no explicit loading/error rendering contract.

- [ ] **Step 3: Implement the minimum state contract**

Use explicit props:

```jsx
export default function Home({ dumps, activeSpace, onOpen, onUserSelect, loading = false, error = '', onRetry }) {
  // ...existing search/profile state...
  if (loading) {
    return <div className="screen">{[0, 1, 2].map((key) => <div key={key} className="feed-skeleton card" data-testid="feed-skeleton" aria-hidden="true" />)}</div>;
  }

  if (error) {
    return (
      <div className="screen">
        <EmptyState
          title="Could not load your feed"
          text="Something went wrong while loading your moments."
          action={onRetry ? <button className="btn" type="button" onClick={onRetry}>Try again</button> : null}
        />
      </div>
    );
  }

  // existing ready-state rendering continues here
}
```

Do not replace the existing EmptyState copy used when `visible.length === 0`.

- [ ] **Step 4: Make the parent distinguish loading/error from empty**

In `src/app/FlicdApp.jsx`, track feed request state:

```jsx
const [feedState, setFeedState] = React.useState({ status: session ? 'loading' : 'idle', error: '' });

async function loadDumps() {
  if (!session) return;
  setFeedState({ status: 'loading', error: '' });
  try {
    const savedDumps = await getFeedDumps();
    // existing formatting/hydration
    setDumps(await hydrateDumpInteractions(formattedDumps));
    setFeedState({ status: 'ready', error: '' });
  } catch (error) {
    console.error('Failed to load social feed:', error);
    setDumps([]);
    setFeedState({ status: 'error', error: error.message || 'Failed to load social feed.' });
  }
}
```

Pass:

```jsx
<Home
  dumps={dumps}
  activeSpace={activeSpace}
  loading={feedState.status === 'loading'}
  error={feedState.status === 'error' ? feedState.error : ''}
  onRetry={loadDumps}
  onOpen={(post) => { setActivePostId(post.id); setScreen('viewer'); }}
/>
```

- [ ] **Step 5: Add focused CSS and verify**

Add to `src/styles.css`:

```css
.feed-skeleton {
  min-height: 230px;
  position: relative;
  overflow: hidden;
  background: var(--card);
}
.feed-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.05), transparent);
  animation: feedSkeletonShimmer 1.25s ease-in-out infinite;
}
@keyframes feedSkeletonShimmer {
  to { transform: translateX(100%); }
}
```

Run:

```bash
npm run test -- src/features/home/Home.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/Home.jsx src/features/home/Home.test.jsx src/app/FlicdApp.jsx src/styles.css
git commit -m "feat: distinguish feed loading and error states"
```

---

### Task 2: Refactor the post viewer interaction structure

**Files:**
- Modify: `src/features/home/Home.jsx`
- Test: `src/features/home/Home.viewer.test.jsx`

**Interfaces:**
- Consumes: `Viewer` props including `post`, `onLike`, `onComment`, `onKeep`, `onMarkViewed`.
- Produces: semantic containers with `post-actions`, `post-conversation`, and `comment-composer` hooks for the multimodal comment task.

- [ ] **Step 1: Write the failing structural tests**

```jsx
it('separates viewer actions from the conversation region', () => {
  render(<Viewer post={samplePost} onLike={() => {}} onComment={() => {}} onKeep={() => {}} onClose={() => {}} />);
  expect(document.querySelector('.post-actions')).toBeTruthy();
  expect(document.querySelector('.post-conversation')).toBeTruthy();
  expect(document.querySelector('.comment-composer')).toBeTruthy();
});
```

Add a narrow-layout assertion that all three regions exist as siblings under the viewer card rather than being nested inside the media container.

- [ ] **Step 2: Run the test and verify failure**

```bash
npm run test -- src/features/home/Home.viewer.test.jsx
```

Expected: FAIL because the current viewer has no semantic interaction/conversation containers.

- [ ] **Step 3: Implement the structure**

Keep media/navigation unchanged, then render:

```jsx
<div className="post-actions">
  <button className="btn" ...>...</button>
  <button className="btn" ...>...</button>
</div>

<section className="post-conversation" aria-label="Conversation">
  {/* existing comments; multimodal composer will replace the current input in Task 6 */}
  <div className="comment-composer">...</div>
</section>
```

- [ ] **Step 4: Add mobile-safe styling**

Add to `src/styles.css`:

```css
.post-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.post-conversation {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  min-width: 0;
}
.comment-composer {
  min-width: 0;
}
@media (max-width: 620px) {
  .post-actions > .btn { flex: 1 1 140px; }
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- src/features/home/Home.viewer.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/Home.jsx src/features/home/Home.viewer.test.jsx src/styles.css
git commit -m "refactor: separate post actions and conversation"
```

---

### Task 3: Harden optimistic like pending behavior

**Files:**
- Modify: `src/app/FlicdApp.jsx`, `src/features/home/Home.jsx`
- Test: `src/features/home/Home.likes.test.jsx`

**Interfaces:**
- Consumes: existing `likeDump(id)` / `unlikeDump(id)` APIs.
- Produces: `pendingLikeIds` state that disables only the active like button while preserving rollback behavior.

- [ ] **Step 1: Write failing tests**

```jsx
it('disables a like button while its request is pending', async () => {
  const deferred = createDeferred();
  const likeDump = vi.fn(() => deferred.promise);
  // render the parent/viewer with the mocked request
  fireEvent.click(screen.getByRole('button', { name: /like/i }));
  expect(screen.getByRole('button', { name: /like/i })).toBeDisabled();
  deferred.resolve();
  await waitFor(() => expect(screen.getByRole('button', { name: /like/i })).not.toBeDisabled());
});

it('rolls back the optimistic state when like fails', async () => {
  // mock rejection and assert the original count/liked state returns
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/home/Home.likes.test.jsx
```

Expected: FAIL because there is no per-post pending set.

- [ ] **Step 3: Implement per-post pending state**

In `FlicdApp.jsx`:

```jsx
const [pendingLikeIds, setPendingLikeIds] = React.useState(() => new Set());

const toggleLike = async (id) => {
  if (pendingLikeIds.has(id)) return;
  const post = dumps.find((dump) => dump.id === id);
  if (!post) return;
  const nextLiked = !post.liked;
  setPendingLikeIds((current) => new Set(current).add(id));
  setDumps((current) => current.map((item) => item.id === id
    ? { ...item, liked: nextLiked, likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)) }
    : item));
  try {
    if (nextLiked) await likeDump(id);
    else await unlikeDump(id);
  } catch (error) {
    setDumps((current) => current.map((item) => item.id === id
      ? { ...item, liked: post.liked, likes: post.likes }
      : item));
    onToast(error.message || 'Could not update like');
  } finally {
    setPendingLikeIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }
};
```

Pass `likePending={pendingLikeIds.has(post.id)}` to `Viewer`.

- [ ] **Step 4: Disable only the active like control**

```jsx
<button className="btn" type="button" onClick={() => onLike(post.id)} disabled={likePending} aria-label={post.liked ? 'Unlike' : 'Like'}>
  ...
</button>
```

- [ ] **Step 5: Verify**

```bash
npm run test -- src/features/home/Home.likes.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/FlicdApp.jsx src/features/home/Home.jsx src/features/home/Home.likes.test.jsx
git commit -m "fix: prevent duplicate like requests"
```

---

### Task 4: Normalize Dump and Roll publishing states

**Files:**
- Modify: `src/features/capture/CaptureBuilders.jsx`
- Test: `src/features/capture/CaptureBuilders.publish.test.jsx`

**Interfaces:**
- Consumes: existing `onPost` callbacks and upload validation.
- Produces: consistent `posting` behavior, disabled controls during upload, preserved selections, and inline failure state in both builders.

- [ ] **Step 1: Write failing tests**

```jsx
it('keeps Dump selections while posting and disables posting controls', async () => {
  const deferred = createDeferred();
  const onPost = vi.fn(() => deferred.promise);
  render(<DumpBuilder activeSpaceId="main" onCancel={() => {}} onPost={onPost} />);
  // select a valid File through the file input helper
  fireEvent.click(screen.getByRole('button', { name: /Post dump/i }));
  expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled();
  deferred.resolve();
});

it('preserves a failed Dump selection for retry', async () => {
  const onPost = vi.fn().mockRejectedValue(new Error('upload failed'));
  // select valid file and submit
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('upload failed'));
  expect(screen.getByText(/photo selected/i)).toBeInTheDocument();
});
```

Create equivalent Roll assertions around `Develop roll` / `Post roll` and a failed publish.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm run test -- src/features/capture/CaptureBuilders.publish.test.jsx
```

Expected: FAIL for any missing loading/error accessibility contract.

- [ ] **Step 3: Implement shared publish status conventions**

Use the existing `posting` state, but ensure every submit button stays mounted with text changing between normal and loading. Do not clear `files`, `capturedFiles`, or their other form state in the `catch` path.

Dump:

```jsx
<button className="btn btn-primary" disabled={!files.length || posting} onClick={post}>
  {posting ? 'Uploading…' : 'Post dump'}
</button>
```

Roll post button:

```jsx
<button className="btn btn-primary" disabled={!developed || posting} onClick={post}>
  {posting ? 'Uploading…' : 'Post roll'}
</button>
```

Use `role="alert"` for errors and keep the selected content visible.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/capture/CaptureBuilders.publish.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/capture/CaptureBuilders.jsx src/features/capture/CaptureBuilders.publish.test.jsx
git commit -m "fix: normalize dump and roll publishing states"
```

---

### Task 5: Verify Storage cleanup and persistence ordering for publishing

**Files:**
- Modify: `src/app/FlicdApp.jsx` only if ordering/cleanup is incomplete
- Test: `src/app/FlicdApp.publish.test.jsx`
- Reference: `src/features/capture/mediaUpload.js`
- Reference: `src/features/capture/dumpApi.js`

**Interfaces:**
- Consumes: `uploadDumpImages`, `removeDumpImages`, and `createDump`.
- Produces: a publish sequence where Storage objects are removed when database persistence fails and Home changes only after persistence succeeds.

- [ ] **Step 1: Write failing tests**

```jsx
it('removes uploaded media when dump persistence fails', async () => {
  // mock uploadDumpImages => ['user/path.jpg']
  // mock createDump => reject
  // trigger post
  await waitFor(() => expect(removeDumpImages).toHaveBeenCalledWith(['user/path.jpg']));
});

it('does not navigate Home before createDump succeeds', async () => {
  // hold createDump pending and assert the current screen remains the builder
  // resolve and then assert screen changes to Home
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/app/FlicdApp.publish.test.jsx
```

Expected: FAIL only if a required ordering/cleanup behavior is missing.

- [ ] **Step 3: Keep the existing cleanup path exact**

The intended sequence is:

```jsx
uploadedPaths = await uploadDumpImages(imageFiles);
const savedDump = await createDump(...);
setDumps(...);
setScreen('home');
```

In the catch path:

```jsx
if (uploadedPaths.length) await removeDumpImages(uploadedPaths);
throw error;
```

Apply the same invariant to `postRoll`.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/app/FlicdApp.publish.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/FlicdApp.jsx src/app/FlicdApp.publish.test.jsx
 git commit -m "test: verify publish persistence and media cleanup"
```

---

### Task 6: Integrate the multimodal comment composer boundary

**Files:**
- Modify: `src/features/home/Home.jsx`, `src/app/FlicdApp.jsx`
- Test: `src/features/home/Home.viewer.test.jsx`
- Depends on: multimodal comment plan Tasks 1-6

**Interfaces:**
- Consumes: `CommentComposer` callback `onCommentCreated(comment)` and normalized comment rows.
- Produces: Viewer that delegates all comment composition to the multimodal subsystem and appends the returned normalized comment without duplicating media logic.

- [ ] **Step 1: Write failing integration test**

```jsx
it('delegates new comments to the multimodal composer', async () => {
  render(<Viewer post={samplePost} onCommentCreated={vi.fn()} ... />);
  expect(screen.getByTestId('comment-composer')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/features/home/Home.viewer.test.jsx
```

Expected: FAIL because the current viewer owns a plain text input.

- [ ] **Step 3: Replace only the composer boundary**

```jsx
<CommentComposer
  dumpId={post.id}
  onCommentCreated={onCommentCreated}
/>
```

Keep the viewer responsible for post-level layout and comment list placement.

- [ ] **Step 4: Verify**

```bash
npm run test -- src/features/home/Home.viewer.test.jsx
```

Expected: PASS once the multimodal plan has produced `CommentComposer`.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/Home.jsx src/app/FlicdApp.jsx src/features/home/Home.viewer.test.jsx
 git commit -m "feat: connect post viewer to multimodal comments"
```

---

### Final Verification for this plan

- [ ] Run focused feed/capture tests:

```bash
npm run test -- src/features/home src/features/capture src/app
```

- [ ] Run the complete suite:

```bash
npm run test
```

Expected: all tests pass and the count is at least the previous **83/83** baseline plus the new tests.

- [ ] Run a manual phone check for Home → open post → actions → conversation → comment composer, plus Dump and Roll publish flows in portrait and landscape.
