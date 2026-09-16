# Flic'd Companion v1 — Design Specification

**Date:** 2026-09-16  
**Status:** Ready for implementation after review

## Goal

Add a standalone interactive Companion that lives at the application-shell level and is independent from Boards. Companion v1 provides a persistent floating character, bounded autonomous movement, idle animation, direct interaction reactions, pointer/touch dragging, and Companion/Quiet modes.

## Seasonal integration

The existing seasonal event system remains the single source of truth for seasonal Companion behavior. Active seasonal events currently expose character and interaction metadata for Christmas, Halloween, and Valentine's Day. The Companion reads this event data rather than duplicating dates or holiday logic.

When a seasonal event is active:
- the Companion reflects the event's character metadata where v1 supports it (for example, seasonal hat/accessory indicators);
- the Companion uses the event's interaction target and reaction when clicked/tapped;
- seasonal environment effects remain owned by the existing seasonal layer, not duplicated by Companion;
- when no event is active, the Companion falls back to its normal v1 appearance and reactions.

## Overlay and positioning

- Render Companion above primary application content from `AppShell`.
- Keep the overlay pointer-transparent except for the Companion itself.
- Use a responsive play area derived from the app frame rather than hard-coded device dimensions.
- Reserve space around the bottom navigation and screen edges so the Companion cannot cover essential navigation controls.
- Clamp all autonomous and dragged positions to the play area.
- Position is stored locally so refreshes preserve the last placement.

## Modes

### Companion mode

- Companion is visible.
- Autonomous wandering is enabled.
- Idle animation continues when stationary.
- Direct interaction triggers a reaction.

### Quiet mode

- Companion is hidden/minimized from the primary view.
- Autonomous movement is stopped.
- Timers/animation loops are cleaned up.
- Mode survives a page refresh through local persistence.

## Movement

- Start from the persisted position or a safe default.
- Wander only after a pause so movement is not constant.
- Choose destinations inside the play area.
- Move with a restrained transition rather than jumping.
- Pause after reaching a destination before selecting another.
- Dragging cancels the active autonomous move and writes the new position.

## Interaction

Click/tap on the Companion:
- cancel autonomous movement temporarily;
- enter a short reaction state;
- show a compact reaction bubble;
- use seasonal reaction content when an event supplies it;
- return to idle after the reaction.

The interaction API is intentionally local-only in v1; no Supabase table is added for ephemeral animation state.

## Rendering

Use a lightweight, dependency-free character treatment so v1 works without new image assets. The character should have a readable silhouette, idle motion, and seasonal accessory indicators using the existing design language. Appearance/accessory customization will be added later without changing the core interaction state model.

## Accessibility and reduced motion

- Companion has an accessible button label and interaction description.
- Dragging must not be the only way to control it.
- Quiet mode is available as a visible control near the Companion.
- Respect `prefers-reduced-motion` by disabling autonomous movement and decorative animation while retaining static interaction/reaction feedback.
- Keep controls keyboard reachable.

## Testing

Add unit tests for:
- position clamping;
- deterministic safe/default positioning;
- mode persistence/normalization;
- seasonal metadata mapping;
- reaction selection;
- reduced-motion behavior where practical.

Add component tests for:
- Companion rendering;
- Quiet mode visibility;
- click reaction;
- drag clamping;
- seasonal presentation.

Existing tests and production build must remain passing.

## Future compatibility

V1 intentionally leaves extension points for:
- appearance customization;
- accessories beyond seasonal indicators;
- richer animation sets;
- personality and reaction libraries;
- persisted companion preferences/profile data.

These future features must build on the same Companion boundary rather than re-coupling it to Boards.
