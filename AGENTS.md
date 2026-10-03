<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- In-app event calls use `@daily-co/daily-js` call-object mode with a custom Campfire UI; keep access, token, and expiry enforcement in `video.functions.ts` so presentation changes cannot weaken room security.
- The four discovery pages share the reusable dealt-hand pattern; keep recommendation presentation client-side so visual shuffling never changes backend rules.
- Appreciation read receipts must go through the authenticated server function and its service-only database function; never add a broad member update policy.
- Appreciation send motion uses one requestAnimationFrame timeline; keep persistence immediate and independent from decorative playback.
