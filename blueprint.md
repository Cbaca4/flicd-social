# What changed with this round

Your latest doc's own phasing — foundation, then social, then private
messaging, then identity, then "signature features" — is the right call,
and it's the filter I used to decide what actually went into the code
this time versus what's noted for later.

## Added to the schema/backend (these were genuinely foundational)

- **OAuth login (Apple/Google)** — no schema change needed; Supabase Auth
  handles this natively. Just flip the providers on in the dashboard
  (README covers it). Email/password from the original plan still works
  alongside it.
- **Interest-based onboarding** — new `interests` and `space_interests`
  tables, plus `/api/interests` and `/api/spaces/:id/interests`. The feed
  route now actually scores posts higher when their `topic_tags` overlap
  with your selected interests.
- **"Why am I seeing this?"** — the feed route returns a `reasons` array
  per post (follows this space / matches your interests / liked by N
  people) instead of a black-box score, so the UI can surface it directly.
- **Granular visibility, separated from expiry** — the earlier draft
  conflated "who can see this" with "how long it lasts." Now a dump has
  both a `visibility` (`public` / `followers` / `close_friends` /
  `specific` / `only_me`) and an `expiry_mode` (`24h` / `once`)
  independently. `close_friends` checks your existing close-circles;
  `specific` uses a new `dump_audience` table.
- **Blocking and reporting** — new `blocks` and `reports` tables plus
  `/api/blocks` and `/api/reports`. Blocking is enforced inside the same
  `can_view_dump` check that handles visibility, and in message inserts —
  a block isn't just a UI-level filter.
- **Draft dumps ("Post Later")** — dumps now have a `status` of `draft`
  or `posted`. A draft has no `expires_at` and is invisible to everyone
  but its owner until a `publish_draft_dump` call posts it, at which
  point the 24h countdown (if that's the mode) starts fresh.
- **Message requests groundwork** — `messages` now has a `status`
  (`pending`/`accepted`/`declined`) so a stranger's DM can land in a
  requests queue instead of the main inbox. The accept/decline policy is
  in place; the requests-tab UI itself isn't built yet.
- **Raw Mode flag** — a `raw_mode` boolean on `spaces`, ready for a space
  to hide its own counts/polish, per your idea.

## Deliberately left out of the code (this is the "flashy features" phase)

- **MySpace-style profile customization** — there's a `profile_theme
  jsonb` column on `spaces` sitting empty, ready to hold whatever theme
  schema you land on, but no theming UI yet.
- **Games** (Snake, 2048, etc.) — genuinely unrelated to the privacy/data
  foundation; add whenever, doesn't block anything else.
- **Wrapped computation** — the `wrapped_snapshots` table exists from the
  last round, but nothing populates it yet.
- **Archive as a browsing UI** — per your own doc's structure, this is
  best built as a chronological view *over* `boards`/`board_items`, not
  a separate storage system. No new table needed, just a UI question for
  later.
- **Collab/"Dump Together" dumps** — the schema (`dumps` + `dump_items`)
  can support multiple contributors with a small join-table addition, but
  that's a real design decision (who can add items, can they remove each
  other's) worth its own pass rather than a guess baked in now.

## One structural note worth flagging

Row-level security is doing essentially all of the privacy enforcement
in this schema — visibility, blocks, close friends, specific-audience
posts, hidden follow lists. That's the right place for it (a client can't
bypass a database policy the way it can bypass a UI check), but RLS
policies compose in non-obvious ways once you have several interacting
(this schema needed a couple of `SECURITY DEFINER` helper functions to
get "am I blocked" and "am I in their close circle" checks to work
correctly — the comments in `schema.sql` explain why each one needed it).
Test the permission boundaries directly with real test accounts before
launch, not just by reading the policies.
