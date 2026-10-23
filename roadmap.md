# Roadmap

- [ ] Consolidate membership Stripe on Oka: verify saved key, create monthly price directly, update app price and check founding read access without checkout or publishing.

- [x] Harden signed-out and unpaid-member entry checks; preserve grandfathered members; 75 tests passed, real full-member directory and simulated unpaid redirection verified without payments.

- [x] Add membership choices and verified paid-membership storage with monthly Stripe price.
- [x] Gate unpaid limited accounts globally, preserve invite attribution and send paid limited members to onboarding.
- [x] Verify access rules and preview without creating checkout sessions or making payments (57 tests; real full member; simulated unpaid limited account).
- [ ] Enable founding payment verification: existing supplied Payment Link belongs to a different Stripe account than the unchanged connected key; requires the correct account connection and a session-id return URL.

- [x] Add grandfathered member status and automatic December 1 full-access rule.
- [x] Gate limited-member browsing without changing payments or onboarding UI.
- [x] Tighten profiles/themes and flagged file reads; verify full-member Home/Members and access rules (limited UI tested with simulated responses, not a real limited account).
- [x] Show the /welcome "Your place in the family is kept" card to limited members only; verify full member and simulated paid limited member.

- [x] Add Home spaces, decks, appreciation letters and Home-first navigation.
- [x] Rename user-facing Directory copy to Members while preserving `/directory`.
- [x] Verify Home changes in preview; prior verification limits are recorded in chat.
- [x] Add three skippable Oka introduction screens before the prototype chat, with session-only progress and replay.
- [x] Verify introduction navigation, refresh, skip and restart at 390px and desktop; preview reports no errors.
- [x] Apply Daniel's facilitator-only application and draft-term updates, preserving direct-link-only noindex.
- [x] Verify facilitator draft validation, persistence and desktop/mobile flow without sending data.
- [x] Add direct admin editing on skills, members, events and houses while preserving existing permissions.
- [x] Verify direct edit saves in preview and permission-gate tests; restore all original test values.
- [x] Reorder Home: events, featured skills/homes/members, themes, then the postcards at the bottom.
- [x] Remove the large "Home" headline from the Home page header.

- [x] Founding member page ($250 lifetime, Stripe)
