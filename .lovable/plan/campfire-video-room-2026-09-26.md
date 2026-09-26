# Campfire video room

## What will change
- Replace the embedded Daily grid with a custom Oka call room built on Daily's call object.
- Keep the existing event access checks, on-demand room creation, tokens, roles, timing, links, and expiry unchanged.
- Add a pre-join preview with member identity, microphone/camera controls, and “Take your seat by the fire.”
- Render stable participant seats around an animated central fire, with muted state and names on hover or tap.
- Add a large active-speaker pane beside the circle on desktop, separated by a draggable divider whose position lasts for the call.
- Use a floating active-speaker bubble on mobile that can be expanded and collapsed.
- Add custom mic, camera, leave, and owner-only end-call controls.

## Performance and behavior
- Keep audio subscribed for everyone.
- Subscribe to video only for the active speaker, the local member, and a small recent-speaker set.
- Preserve each participant's seat assignment when people join or leave; additional participants flow into stable outer rings.
- Use Daily participant and active-speaker events to update tracks, speaking emphasis, mute marks, and recent speakers.
- Gracefully handle permissions, loading, disconnects, and the existing missing-key fallback.

## Visual direction
- Extend the existing token palette with semantic fire, ember, firelight, and room-surface tokens.
- Build the fire with lightweight CSS animation and respect reduced-motion settings.
- Keep all controls and surfaces within Oka's warm cream, terracotta, sage, sand, and brown system.

## Verification
- Confirm the app builds successfully.
- Open a configured virtual event as an authorized member and verify pre-join, campfire seats, speaker pane, call controls, and divider interaction.
- Check desktop and mobile layouts.
- Report separately what requires a live multi-member call to validate.
