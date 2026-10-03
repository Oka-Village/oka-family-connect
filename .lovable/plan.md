# Oka Home, Members, and Appreciation

## What will change
- Add `/home` as the first signed-in destination and first navigation item on desktop and mobile. Make the signed-in Oka logo open Home, and send completed sign-in/onboarding flows there.
- Keep `/directory` intact while changing every visible “Directory” label, heading, message, and page title to “Members”.
- Build a calm Home page with three large, responsive space cards. The active space is stored in `?space=` so Reflection, Inspiration, and Appreciation can be linked directly.

## Home spaces
- **Reflection:** a dark, introspective Oka-backed deck with at least 40 original prompts, non-repeating random draws, flip/deal motion, keyboard controls, loading/empty/error handling, and reduced-motion behavior.
- **Inspiration:** a visually distinct warm, horizontal deck with at least 40 correctly attributed or anonymous quotes, rise-and-fan motion, and the same reliable draw behavior.
- **Appreciation:** a letter composer with one searchable member mention, 280-character counter, inline validation, keyboard/touch mention controls, and a fold/envelope/dove send sequence. Received and Sent tabs show letter cards, unread state, relative dates, and warm empty/error/loading states.

## Data and security
- Add `appreciation_letters` through a migration, referencing member profiles, with body and sender/recipient checks, both requested indexes, explicit grants, RLS, sender-only insert, sender-or-recipient select, admin moderation read, and no member delete/update access.
- Add a security-definer `mark_letter_read` function so recipients can update only `read_at` for their own letters.
- Enforce ten letters per sender per rolling database day in a database trigger and return a friendly app message when reached.
- Reuse the existing visible-profile source for debounced member mentions; exclude the sender, return at most eight names/avatars, and never request email fields.
- Subscribe to letter changes for the current recipient and refetch on focus so received letters and the Home unread badge stay current.

## Technical details
- Keep UI pieces focused: `HomePage`, `DeckCard`, `ReflectionDeck`, `InspirationDeck`, `AppreciationComposer`, `MentionPicker`, `LetterCard`, and `DoveAnimation`; keep prompts and quotes in a separate constants module.
- Use existing Oka controls, avatar handling, semantic tokens, serif/sans typography, spacing, cards, focus rings, and reduced-motion conventions. No unrelated page redesigns.
- Update generated database types after the migration is applied, without weakening existing policies.

## Verification
- Check strict TypeScript and preview health with no console/runtime errors.
- Test both decks, Home deep links, logo navigation, default landing, and every user-facing “Members” rename on desktop and mobile.
- Send a test appreciation between two available member accounts, confirm Sent and Received/unread behavior, mark it read, then remove test data with privileged cleanup. If the backend contains only one member, complete all single-user checks and report the blocked two-account verification explicitly.
