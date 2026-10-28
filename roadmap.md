# Roadmap

- [ ] Use production event share URLs and expose Invite in mobile tabs/footer; verify and capture Daniel's Home and affiliate pages at 390px without publishing.

- [x] Free Google signup to onboarding; require every member's photo, with an authorized onboarding-only root boundary exception.
- [x] Add dismissible Support Oka choices with existing checkouts and one-time trial recording, leaving other access rules and direct membership visits unchanged.
- [x] Verify 89 focused tests, signed-out landing and direct membership preview, nullable trial column and unchanged protected files; no publish or checkout created.
- [ ] Verify authenticated signup through photo upload, post-onboarding modal and persisted trial read-back; blocked by no available requesting-user session (self session mint failed). Local-only isolated screen harness did not complete, so modal visual verification remains unconfirmed.

- [x] Restore shared signup default to full and align client launch access with verified payment; 76 tests and real full-member Home/welcome plus signed-out membership verified; all 25 profiles and Kyle's membership untouched.
- [x] Require verified payment from existing and new non-staff members in preview UI; 77 tests and simulated existing unpaid full-member redirect verified; real admin access preserved, no profile/payment changes.
- [ ] Synchronize existing-member paid-access enforcement in shared database with the new live payment UI; deferred because tightening shared policies now would lock the old live app out before publishing.
- [x] Initialize only future new-flow signups as limited using a server-issued pre-Google marker; 80 tests passed, real existing-account no-op verified; new-account end-to-end not tested because no test accounts authorized.
- [x] Walk both checkouts signed in without paying; both show Oka and correct USD base amounts. Monthly success/cancel URLs verified; founding Payment Link uses hosted confirmation, not an Oka return.

- [x] Consolidate membership Stripe on Oka: saved key verified, monthly price created directly, app price updated and founding Payment Link read access confirmed; no setup endpoint or file created, no checkout or publishing.

- [x] Harden signed-out and unpaid-member entry checks; preserve grandfathered members; 75 tests passed, real full-member directory and simulated unpaid redirection verified without payments.

- [x] Add membership choices and verified paid-membership storage with monthly Stripe price.
- [x] Gate unpaid limited accounts globally, preserve invite attribution and send paid limited members to onboarding.
- [x] Verify access rules and preview without creating checkout sessions or making payments (57 tests; real full member; simulated unpaid limited account).
- [x] Align founding verification key with the Oka Payment Link account; direct read confirmed.
- [ ] Configure founding Payment Link session-id return destination; read confirmed hosted confirmation (no Oka redirect); changing the live link setting was not authorized in the no-charge walk.

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
