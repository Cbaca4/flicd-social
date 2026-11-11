# Companion costume fit: prototype and proposed rollout

Status: review-only prototype. No shipped Companion, Settings, source sprite sheet, seasonal configuration, or other feature has been changed. No dependencies, paid generation, commits, pushes, remote data access, or deployments.

## Open the prototype

Open `evidence/review.html` directly in a browser. It is self-contained; no application login, environment variables, network access, or dev server is needed. The source version is `index.html`, served by the verification command below.

Screenshots:
- `evidence/desktop-right.png`
- `evidence/desktop-left.png`
- `evidence/mobile-left-reduced-motion.png`

The screenshot comparisons use a neutral seasonal context and the application's actual built CSS order. “Current” shows existing sprites and overlays; “Fitted prototype” shows the proposed frame-specific treatment. Proposed Settings samples are rendered by the exact same prototype function, not re-created with separate CSS. These are not approved golden snapshots.

## Findings

- `Companion.jsx` and `CompanionSettings.jsx` each own a separate five-row mapping. Superhero and seasonal CSS costumes fall back to Everyday in Settings because its sprite class does not receive the on-screen overlay rules.
- The existing sheet has ten walking frames and two genuinely different sitting frames. Walking body offsets are 0, -1, 0, +1, 0, -1, 0, +1, 0, -1. The two seated heads move +2/+4 and +3/+5 relative to the standing head. Both CSS accessories and the four existing costume rows repeat fixed accessory positions across these poses.
- `CompanionCostume.css` conflicts with `Companion.css`. The production build emits the former first, so several attempted alignment overrides lose to the latter. The before comparisons intentionally reproduce this conflict, verified in Chrome.
- The existing 58px Settings sample scales a 96px source frame to a fractional ratio; mobile also uses a fractional character transform. These should be replaced with consistent native-pixel sizing (or integer multiples) after checking the complete Settings layout.

## Prototype behavior

Three representative costumes: Superhero (cape, tunic, eye mask), Santa (hat, coat), Witch (hat, tunic). The original body frames are referenced without changing their geometry or colors. Rear cape is drawn before the body; stepped clothing is clipped to each torso silhouette; hat/mask anchors follow each head; original visible ear and eye pixels are drawn last. There are no costume gradients, rotations, skew transforms, or fractional sprite coordinates.

Side-by-side idle, raised/lowered walk, and both seated poses are shown. Playback cycles through all ten walk frames. Direction changes mirror the complete character; a live reduced-motion preference disables/stops playback. Comparisons render at exactly 2x on desktop and 1x on narrow screens. The proposed preview uses native 96x72 art; its larger layout needs approval before integration.

## Proposed production approach (not yet applied)

1. Retain all existing base body/face/leg frames and current patrol/reaction behavior.
2. Bake fitted rear/body/head/foreground layers into sprite-sheet frames, rather than independent CSS pseudo-elements. Use the existing 96x72 coordinate system and twelve-frame animation timing. The runtime continues to animate one background image; it does not rebuild SVG markup every tick as the review experiment does.
3. Share sprite selection, costume mapping, seasonal treatment, and pose between Companion and Settings through one renderer. Keep decorative art hidden from accessibility APIs; retain the labeled reaction button, keyboard focus treatment, status announcements, settings labels, and reduced-motion rules.
4. Extend the fitted art to every existing costume and seasonal variation. Remove the conflicting costume overlay rules in Companion CSS only once replacements cover the full inventory. Do not alter availability dates, costume values, persistence rules, or seasonal reactions.
5. Cover every costume/frame and neutral/Halloween/Christmas/Valentines treatment in automated rendering checks; verify Settings/equipped source and pose equality; capture both directions, desktop/mobile, and reduced-motion comparisons. Request approval of visual baselines rather than auto-blessing snapshots.

Likely integration files: `Companion.jsx`, `CompanionSettings.jsx`, `Companion.css`, `CompanionCostume.css`, new Companion-local sprite metadata/renderer and generator or fitted sprite assets, plus their tests. No View Once, Boards, Supabase, Auth, migrations, or unrelated files.

### Full costume inventory to preserve

Presets: Everyday (`none`), Santa, Ghost, Witch, Valentine, Superhero (`hero`), Speedster, Cosmic Hero (`cosmic`).

Halloween: Pumpkin King (`pumpkin-king`), Vampire, Little Reaper (`reaper`).

Christmas: North Pole Elf (`elf`), Gingerbread, Rudolph (`reindeer`).

Valentines: Cupid, Love Letter (`love-letter`).

Total: 16 costume identifiers. Also preserve the currently defined Halloween accents for Everyday/Superhero/Speedster/Cosmic, Christmas Everyday hat, and Valentines Everyday hearts, but fit them to pose-specific art instead of CSS overlays.

## Verification

Run from the worktree root:

    npm test -- src/features/companion
    node src/features/companion/prototype/verifyPrototype.mjs
    npm run lint
    npm run build

The browser command uses installed Chrome and Node built-ins only, serves an explicit six-file local allowlist on 127.0.0.1, uses a fresh disposable Hermes scratch profile, and closes the browser/server afterward. A Chrome executable can be supplied as its first argument. It generates the portable HTML, three screenshots, and `evidence/browser-results.json`. The report's loopback URL is temporary and is no longer running when verification ends.

Verified results:
- Original Companion baseline: 43 tests passed before changes.
- Final Companion suite: 50 tests across 6 files, including 7 new prototype tests.
- Real Chrome: 36/36 raster cases passed (three costumes x twelve frames), plus the same cases for the portable file. Checks enforce opaque-body clothing containment, unchanged protected ear/eye/muzzle/foot pixels, and no partial-alpha costume edges. An initial one-pixel overhang in seated frame 11 failed these checks and was corrected.
- Chrome direction transforms, playback, live reduced-motion changes, 390px viewport without horizontal overflow, native control focus, and absence of JavaScript exceptions/console.error are checked. Desktop/mobile screenshots were visually inspected; this is not a physical-device or full accessibility audit.
- Lint passed.
- Production build passed with a greater-than-500kB chunk warning; no unrelated optimization attempted.
- Full `npm test` did not pass: 15 files failed because Supabase initialization requires absent `VITE_SUPABASE_URL` configuration. In that run, 48 files passed, 12 suites could not collect tests, and 3 tests failed (190 tests passed). No credentials were read and no Supabase changes were made to bypass this. Two prototype guards and a CSS-order regression were added after that full-suite run; the final scoped Companion suite was rerun.

## Approval gate / outstanding work

Review the fit, palette, cape shape, mask, and proposed native-size Settings sample before a full rollout. All remaining costumes, seasonal combinations, application integration, production Settings equality, device QA, and approved screenshot baselines are still outstanding. This prototype is deliberately not a claim that the entire requested costume improvement has shipped.
