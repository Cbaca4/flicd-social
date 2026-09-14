# Flic'd Social App — Product Requirements & Design Specification

**Date:** 2026-09-14  
**Status:** Approved design direction; awaiting written-spec review before implementation planning  
**Scope:** Merge/refactor the supplied prototype and blueprint, then extend the application into a cohesive production-quality social product.

## 1. Product Goal

Flic'd is a privacy-first social application centered on temporary photo/video sharing through Spaces, Dumps, and Rolls. This work preserves those differentiating concepts while improving navigation, messaging, profile organization, discovery, responsiveness, and the new global photo-ranking experience.

The uploaded prototype currently implements a single-file React experience with sign-up, spaces, home feed, dump/roll creation, a viewer, kept content/Boards, profile, and a bottom navigation bar. The current navigation still exposes Boards and the shell is fixed to a 360×700 viewport.

The uploaded blueprint documents foundational backend concepts including OAuth support, interest-based onboarding, explainable feed ranking, granular visibility independent of expiry, blocks/reports, draft dumps, message-request statuses, and an existing RLS privacy model.

## 2. Product Principles

1. Preserve Flic'd's identity instead of turning it into an Instagram clone.
2. Prefer real functionality over visual placeholders.
3. Keep privacy/security decisions at the data layer where the existing blueprint already establishes them.
4. Make every feature responsive and usable across device sizes.
5. Treat the PRD checklist as the definition of done.
6. Refactor only where it serves maintainability, correctness, or this product scope.

## 3. Navigation & Application Shell

### Primary navigation

Replace the current bottom-navigation destinations with:

**Home | Discovery | Capture | Messages | Profile**

Boards is removed from primary navigation and retained inside Profile.

### Navigation requirements

- Bottom navigation is persistent on primary application views.
- Navigation is translucent/glass-like with rounded corners.
- Center Capture action is visually emphasized while remaining part of the dock.
- Bottom safe-area insets are respected on devices with gesture/navigation areas.
- Active/inactive states are obvious and accessible.
- No primary navigation item leads to a dead or placeholder screen.
- The navigation shell is responsive rather than hard-coded to phone dimensions.

## 4. Home

Preserve the existing feed and temporary-content experience.

### Functional requirements

- Display content appropriate to the active Space.
- Preserve Dump and Roll cards.
- Preserve expiry state, likes, comments, viewing, keeping, and viewer behavior already represented in the prototype.
- Surface explainable feed reasons when backend data provides them.
- Respect visibility and block rules enforced by the backend.
- Support loading, empty, and error states.
- Avoid exposing expired content as actionable.

## 5. Discovery

Discovery has two internal modes:

**Explore** and **Global**.

### Explore

Preserve the interest-trail experience already represented by the prototype and blueprint.

Requirements:
- Interest chips/trails.
- Recommendation cards/content.
- Randomize interaction.
- Deep-dive entry point where supported.
- Explainable recommendation reasons when available.
- Empty/loading/error states.

### Global photo competition

Global is a first-class Discovery experience for worldwide photo submissions and likes-based ranking.

Requirements:
- Dedicated Global subsection/tab.
- Submission entry point.
- Media selection/upload flow.
- Preview before submission.
- Validation before persistence.
- Optional caption/metadata where supported.
- Current competition display.
- Ranking list.
- Visually distinct 1st, 2nd, and 3rd podium.
- Ranked entries below the podium.
- Creator attribution and profile access where supported.
- Like/vote counts.
- User's own submission/rank visibility where applicable.
- Empty/loading/error states.
- Reporting/moderation entry points.
- Responsive ranking layout.

### Initial ranking model

For the initial release, one active competition is used at a time. Ranking is primarily determined by eligible likes/votes during the active competition period. The implementation must use deterministic ordering for ties and must not rely on client-only sorting as the source of truth.

The exact backend vote/like anti-abuse mechanism must follow the existing data architecture where possible and must prevent straightforward duplicate-vote inflation.

## 6. Capture

Capture is the central creation action.

### Start screen

Offer:
- Start a Dump.
- Start a Roll.

### Dump

Preserve the prototype's core flow:
- Multiple media items.
- Maximum of 20 items.
- Mood selection.
- Context note for the cover item.
- Expiry selection.
- Posting-space selection.
- Post action.

Add where backend support exists:
- Draft/Post Later state.
- Preview before final publish.
- Visibility selection independent from expiry.

The blueprint specifies `visibility` and `expiry_mode` as separate concepts and defines draft dumps as invisible until published.

### Roll

Preserve the prototype's fixed-frame creation model:
- Choose frame count.
- Capture sequential frames.
- No delete/reorder after starting the roll.
- Develop/reveal completed roll.
- Select expiry.
- Select posting space.
- Publish.

The implementation must avoid fake capture semantics in the production flow. Where camera/media APIs are unavailable in the provided environment, integration boundaries should be explicit rather than presenting simulated success as real persistence.

## 7. Messages

Messages replace Boards in primary navigation.

### Messages landing screen

Provide two clearly separated subsections:

**Pending** — incoming message requests awaiting a decision.

**Chats** — accepted/current conversations.

### Pending requirements

- Show pending incoming requests.
- Show sender identity.
- Accept request.
- Decline request.
- Update state immediately after successful action.
- Do not display declined requests as active chats.
- Show pending empty state.
- Show loading and error states.

The blueprint already defines message statuses `pending`, `accepted`, and `declined`; the UI must connect to this model instead of inventing a separate front-end-only request state.

### Chat requirements

- List accepted conversations.
- Show avatar/profile image when available.
- Show username/name.
- Show latest message preview.
- Show timestamp.
- Show unread state.
- Open conversation.
- Send messages.
- Show send failure state.
- Preserve message ordering.
- Support back navigation.
- Respect block/privacy rules.

## 8. Profile

Profile becomes the identity and collection hub.

### Profile requirements

- Profile image/identity header.
- Username/handle.
- Basic profile metadata.
- Followers/following information where available.
- Edit/share affordances where supported.
- Spaces access/switching.
- Feed preference controls already represented in the prototype.
- Boards integrated into the profile.

### Boards requirements

Boards/Kept must remain functional but no longer appear as a bottom-navigation destination.

The profile should expose Boards as a meaningful content collection area.

Requirements:
- Create/view board where supported.
- Display board cover.
- Display item count.
- Open board.
- View saved items.
- Remove saved items where supported.
- Empty state.
- Persist saved content.

The blueprint notes that Archive should be a browsing UI over boards/board_items rather than a separate storage system; therefore this scope does not add a separate archive datastore.

## 9. Spaces

Preserve Spaces as a core identity/privacy concept.

Requirements:
- View spaces.
- Switch active space.
- Preserve space-specific feed context.
- Preserve existing feed-bias controls.
- Preserve privacy language/behavior already supported.
- Avoid exposing one space's linkage to other spaces beyond intended private controls.

## 10. Visual & Interaction System

### Visual language

Retain the current Flic'd palette and typography foundation:
- Deep charcoal background/surfaces.
- Warm amber primary action.
- Cyan secondary accent.
- Muted text hierarchy.
- Space Grotesk for primary UI copy.
- IBM Plex Mono for technical/status metadata where appropriate.

### Quality requirements

- Consistent spacing.
- Consistent radii.
- Consistent borders/elevation.
- Clear hover/pressed/focus/disabled states.
- Smooth but restrained transitions.
- Touch-friendly controls.
- No text clipping.
- No overlapping controls.
- Accessible labels for icon-only controls.
- Keyboard-focus visibility where applicable.
- Sufficient contrast.

The finished UI should be inspired by modern social applications in interaction quality while remaining visually distinct from them.

## 11. Responsive Design

The current prototype's fixed 360×700 shell must be removed.

### Requirements

Support:
- Mobile portrait.
- Mobile landscape.
- Small tablets.
- Large tablets.
- Laptop/desktop.
- Large desktop screens.

Use fluid layout techniques rather than device-specific hacks.

Responsive behavior must cover:
- Navigation.
- Feed cards.
- Discovery grids.
- Podium layout.
- Profile/boards.
- Messaging list and conversation view.
- Capture builders.
- Modals/sheets.
- Media previews.
- Typography and spacing.

## 12. Architecture & Code Quality

The current monolithic component should be decomposed into maintainable feature boundaries.

Recommended high-level structure:

```text
src/
  app/
  components/
    navigation/
    home/
    discovery/
    competition/
    messages/
    profile/
    capture/
    shared/
  hooks/
  utils/
  data/
  styles/
```

The exact implementation may differ after the real project structure is inspected.

### Code requirements

- Remove duplicate logic.
- Remove dead imports and unreachable code.
- Extract reusable UI primitives.
- Separate business logic from presentation where practical.
- Keep state ownership clear.
- Avoid introducing unnecessary global state.
- Keep backend/privacy rules out of purely visual components.
- Preserve working behavior unless explicitly replaced.
- Do not suppress errors or warnings simply to make tests appear clean.

## 13. Backend & Privacy Integration

The blueprint identifies existing backend foundations that should be reused:
- Supabase Auth for email/password and OAuth providers.
- Interests and space interests.
- Explainable feed reasons.
- Granular dump visibility.
- Draft dumps.
- Message-request statuses.
- Blocks/reports.
- RLS and helper functions for privacy boundaries.

Do not invent duplicate schema concepts if an existing backend structure already satisfies the requirement.

Permission boundaries must be tested with real or isolated test accounts before launch, because the blueprint explicitly identifies interacting RLS policies as a critical area.

## 14. Error, Loading, and Empty States

Every major async feature must define:
- Loading UI.
- Empty UI.
- Error UI.
- Retry/recovery behavior where reasonable.
- Disabled states during irreversible actions.

Major features include Home, Discovery, Global, Competition submission, Messages/Pending, Chats, Profile/Boards, Capture, and backend-driven space data.

## 15. Testing Requirements

### Automated/static validation

Where project tooling supports it:
- Build must complete without errors.
- Type/lint checks must pass where configured.
- Existing tests must remain passing.
- New feature tests should cover important state transitions and utilities.

### Functional verification

Manually verify:
- Navigation destinations.
- Capture entry/exit.
- Dump creation.
- Roll creation.
- Viewer interactions.
- Likes/comments/keep behavior.
- Message request acceptance/decline.
- Chat opening/sending.
- Boards access from Profile.
- Global competition submission.
- Like/vote behavior.
- Correct podium ordering.
- Responsive behavior.

### Security/privacy verification

Verify backend policies and client behavior for:
- Visibility restrictions.
- Blocked-user restrictions.
- Specific-audience access.
- Close-friends rules where configured.
- Message insertion restrictions.

## 16. Definition of Done

A PRD requirement is marked complete only when it is:

1. Implemented.
2. Connected to the appropriate state/data layer.
3. Tested through its intended user flow.
4. Responsive.
5. Covered for loading/empty/error states where applicable.
6. Free of known avoidable runtime/console errors.
7. Consistent with the visual system.

## 17. PRD Checklist

### Foundation

- [ ] Merge supplied prototype and blueprint implementation into the real project structure.
- [ ] Preserve existing working Flic'd concepts.
- [ ] Refactor monolithic UI into maintainable feature components.
- [ ] Remove dead/duplicate/broken code.
- [ ] Establish responsive app shell.

### Navigation

- [ ] Home tab works.
- [ ] Discovery tab works.
- [ ] Center Capture action works.
- [ ] Messages tab works.
- [ ] Profile tab works.
- [ ] Boards removed from primary navigation.
- [ ] Bottom dock is translucent, rounded, safe-area aware, and responsive.

### Home

- [ ] Feed renders.
- [ ] Space context works.
- [ ] Dump/roll interactions work.
- [ ] Viewer works.
- [ ] Likes/comments/keep work.
- [ ] Privacy rules are respected.
- [ ] Empty/loading/error states exist.

### Discovery

- [ ] Explore section works.
- [ ] Interest-based discovery works where backend data exists.
- [ ] Global section exists.
- [ ] Global submission flow works.
- [ ] Photo preview works.
- [ ] Validation works.
- [ ] Rankings persist.
- [ ] 1st/2nd/3rd podium works.
- [ ] Remaining rankings work.
- [ ] Voting/likes work.
- [ ] Duplicate vote abuse is addressed.
- [ ] Reporting works.
- [ ] Global loading/empty/error states work.

### Messages

- [ ] Pending section works.
- [ ] Accept request works.
- [ ] Decline request works.
- [ ] Accepted chats appear in Chats.
- [ ] Declined requests stay out of Chats.
- [ ] Chat view works.
- [ ] Sending works.
- [ ] Unread state works.
- [ ] Loading/empty/error states work.
- [ ] Blocking/privacy rules are respected.

### Profile & Boards

- [ ] Profile identity renders.
- [ ] Spaces are accessible.
- [ ] Feed preferences remain functional.
- [ ] Boards appear inside Profile.
- [ ] Saved/Kept content remains accessible.
- [ ] Board content is persisted.
- [ ] Board empty states work.

### Capture

- [ ] Dump flow works.
- [ ] Dump validation works.
- [ ] Dump expiry works.
- [ ] Dump visibility works where supported.
- [ ] Draft/Post Later works where backend support exists.
- [ ] Roll flow works.
- [ ] Roll frame constraints work.
- [ ] Capture/reveal flow works.

### Responsive & Accessibility

- [ ] Mobile portrait verified.
- [ ] Mobile landscape verified.
- [ ] Tablet verified.
- [ ] Desktop verified.
- [ ] Large-screen behavior verified.
- [ ] No major overflow/clipping.
- [ ] Focus/keyboard behavior verified where applicable.
- [ ] Icon-only actions have accessible labels.

### Final Quality Gate

- [ ] Production build passes.
- [ ] Tests pass.
- [ ] No known avoidable console/runtime errors.
- [ ] No dead primary interactions.
- [ ] No unfinished placeholder UI.
- [ ] PRD checklist fully reviewed.
- [ ] Remaining limitations documented honestly if any cannot be resolved.

## 18. Explicitly Out of Scope for This Pass

The blueprint identifies the following as later-phase work and they are not required for this implementation cycle unless existing code makes them unavoidable:

- MySpace-style profile customization UI.
- Games such as Snake/2048.
- Wrapped computation/population.
- A separate archive datastore.
- Collaborative/"Dump Together" contribution rules.

## 19. Implementation Guardrails

- Inspect the actual project before changing files.
- Do not assume the uploaded prototype is the entire production codebase.
- Reconcile the prototype with the real project's existing architecture before merging.
- Reuse existing APIs/schema when they already satisfy a requirement.
- Add missing code only when necessary to make a requirement genuinely functional.
- Never mark a checkbox from appearance alone.
- Never claim tests passed unless they were actually run.


## Profile Studio — Customizable Identity

Profile Studio adds a controlled, MySpace-era-inspired customization system while keeping the visual language and privacy model original to Flic'd. Users can personalize how their profile looks and how selected profile content is arranged without changing the underlying permissions of that content.

### Customizable appearance
- Profile background color.
- Gradient or uploaded background image where supported.
- Profile-card transparency.
- Accent color.
- Border treatment.
- Corner radius.
- Approved typography choices.
- Light/dark presentation options where compatible with the global app theme.

### Customizable layout
- Reorder supported profile sections.
- Show or hide supported sections.
- Choose from layout presets.
- Customize board presentation.
- Pin featured boards.
- Feature selected posts/dumps.
- Add an About section.

### Profile personality
- Custom profile header treatment.
- Status/mood.
- Favorite interests.
- Optional favorite music/artist field.
- Short personal message.
- Optional profile badges.

### Boards within Profile Studio
Boards remain part of Profile and may be styled through supported board cover, title, ordering, and display-style controls. Profile Studio must not duplicate the board storage model. It only controls presentation and ordering.

### Live editor and preview
The Profile Studio editor should use a split or responsive editor/preview experience appropriate to the device. Changes should appear immediately in the preview before save. Users should be able to cancel changes and revert the unsaved editing session without altering persisted profile settings.

### Persistence
Use the existing `profile_theme` JSONB field as the starting persistence model rather than introducing an unnecessary parallel profile-theme table. The theme object should contain only presentation/configuration values, while profile content and privacy permissions remain in their existing data models.

### Privacy boundary
Profile customization must never bypass existing visibility rules. A hidden/private board, post, follower relationship, or other protected data must remain protected regardless of the selected profile theme or layout. The existing RLS/privacy system remains authoritative.

### Profile Studio acceptance criteria
- [ ] Customize Profile entry point is available from Profile.
- [ ] Appearance controls render and update the live preview.
- [ ] Layout controls update supported profile sections.
- [ ] Board presentation controls work without duplicating board storage.
- [ ] Profile personality fields save and reload correctly.
- [ ] Unsaved changes can be canceled without persistence.
- [ ] Saved customization persists across reloads/sessions.
- [ ] Invalid customization values are rejected or normalized safely.
- [ ] Responsive editor works on mobile, tablet, and desktop widths.
- [ ] Customization cannot bypass content/privacy permissions.
- [ ] Empty, loading, and error states are handled.
- [ ] No avoidable console/runtime errors occur in the customization flow.
