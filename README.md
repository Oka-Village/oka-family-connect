# Oka Foundation

Build the foundation for "Oka" - social infrastructure for a global chosen family (no-money home stays and skill sharing in a credit economy; 1 credit = 1 night stay or 1 hour of service). This is the FIRST prompt of a multi-phase build. In this phase, build ONLY the foundation described below - no feature screens yet beyond the shell, a simple Events placeholder page, and the auth/onboarding flow. Quality and scalability of the data model and security outrank speed.



## Brand system (STRICT - encode as design tokens, never hardcode color classes anywhere)

Define all tokens in index.css (CSS variables) and tailwind.config.ts (semantic colors mapped to the variables). Every component must use semantic token classes only.

- Headlines: "Cormorant Garamond" (serif). Body/UI: "Inter" (sans-serif). Import both from Google Fonts.

- Section labels: ALL CAPS with wide letter-spacing (tracking-widest).

- Colors: background "Warm Cream" #F9F8F4; primary text/headers "Dark Brown" #372C24; CTA/accent "Terracotta" #BB6A4D; secondary background "Sage Green Light" #D1E0D7; extended palette: terracotta-light #D1A493, sage #6FA887, sand #E4DACD, golden #E0AC51.

- NEVER pure white (#FFFFFF) page backgrounds - use Warm Cream or Sage Green Light.

- Buttons: pill-shaped (rounded-full), Terracotta fill, white text.

- Cards: soft rounded corners (rounded-2xl), subtle shadow, on Warm Cream.

- Icons: thin-line style (lucide, strokeWidth ~1.5), Terracotta.

- Spacing: generous whitespace; the design should feel open and calming, not dense.

- Wordmark: clean text wordmark "Oka" in Cormorant Garamond (logo image comes later).



## Auth (Google ONLY)

- Sign-in with Google only (Supabase Auth Google provider). No email/password forms. No other providers.

- On first sign-in, run an onboarding experience (multi-step, calm, on-brand): collect basic profile fields step by step (name, photo placeholder/avatar upload, location, age range, profession) with a warm welcome explaining the One World Family vision; skippable steps allowed but a profile_completeness concept must exist.

- Auth shell after login: desktop left sidebar / mobile bottom tab bar, with nav items for the phases to come: Events, Directory, Skills, Houses, My Profile, Credits. Only wire Events to a real placeholder page now ("Events schedule - coming together soon" style on-brand empty state); other items may route to on-brand empty placeholder pages.

- Sign-out in the shell.



## Data model & security (this is the heart of this prompt - build it to scale past 100,000 users)

Use Supabase (Lovable Cloud). Create the schema in ONE clean, well-commented migration - not incremental patches. Rules:

1. Clean normalized tables with proper types, foreign keys with ON DELETE behavior, NOT NULL and CHECK constraints where they make sense. Timestamps timestamptz with created_at/updated_at defaults.

2. Enable RLS on EVERY table at creation, with GRANTs and explicit policies. Roles/authorization via a separate public.user_roles table (user_id FK -> auth.users, role text CHECK in ('admin','facilitator','affiliate','member'), unique(user_id, role)) and a security-definer public.has_role(_user_id uuid, _role text) function used by policies - never store roles on the profile row or in JWT-less places.

3. Indexes NOW on every growth/filter path: all FKs, events(status, starts_at), event_rsvps(event_id), event_rsvps(user_id), credit_ledger(user_id, created_at), houses(status), skills(status), affiliate_referrals(affiliate_id), payments(user_id), payments(stripe_checkout_session_id) unique where present.

4. Tables for this phase and the known phases ahead (create them all now, even if UI comes later):

   - profiles: id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE; display_name, photo_url, location, age_range, profession, relationship_status, intentions text[], gift_excited_to_give text, gift_loved_gestures text, skill_tags text[], travel_frequent text[], travel_desired text[], membership_tier text CHECK IN ('free','full') DEFAULT 'free', profile_completed boolean DEFAULT false, stripe_customer_id text, timestamps. Policies: authenticated read all; update own row only. Auto-create row via trigger on auth.users insert.

   - user_roles as above; default 'member' role assigned by trigger on signup.

   - events: id uuid PK default gen_random_uuid(); title, description, event_type text CHECK IN ('gathering','workshop','pod_session','meditation','retreat'), format text CHECK IN ('virtual','in_person'), starts_at, ends_at, timezone text, venue_address text, video_link text, capacity int CHECK (capacity > 0), host_id uuid REFERENCES profiles(id), status text CHECK IN ('draft','pending_approval','published','cancelled','completed') DEFAULT 'pending_approval', created_by uuid REFERENCES profiles(id), timestamps. Policies: anyone authenticated reads published; creator manages own; admin all.

   - event_rsvps: id, event_id FK ON DELETE CASCADE, user_id FK ON DELETE CASCADE, status text CHECK IN ('going','waitlist','cancelled') DEFAULT 'going', created_at; UNIQUE(event_id, user_id). Policies: read own + event host/admin reads event's; insert/update own.

   - credit_ledger (append-only, this is the source of truth for balances - never store a mutable balance column): id, user_id FK, delta int NOT NULL (positive earn, negative spend), reason text CHECK IN ('hosting_night','pod_completion','profile_completion','workshop_hosting','skill_session_earn','skill_session_spend','booking_lock','booking_spend','booking_refund','manual_adjustment'), reference_type text, reference_id uuid, note text, created_at. Policies: user reads own ledger; only admins insert manual_adjustment; no UPDATE/DELETE policies for anyone (immutable). Provide a SQL VIEW credit_balances AS SELECT user_id, sum(delta) balance GROUP BY user_id.

   - skills: id, owner_id FK, title, category, format text CHECK IN ('virtual','in_person'), duration_minutes int, description, status text CHECK IN ('draft','published','archived') DEFAULT 'published', timestamps. Policies: authenticated read published; owner manage own.

   - houses: id, owner_id FK, title, description, property_type text CHECK IN ('entire_home','private_room'), location_text, lat numeric, lng numeric, photos text[], house_rules text, status text CHECK IN ('draft','pending_approval','published','rejected') DEFAULT 'pending_approval', timestamps. Policies: authenticated read published; owner manage own.

   - affiliates: id, user_id FK UNIQUE, invite_code text UNIQUE NOT NULL default short random code, display_name, status text CHECK IN ('active','paused') DEFAULT 'active', commission_pct numeric DEFAULT 10 CHECK (commission_pct >= 0 AND commission_pct <= 100), timestamps. Policies: owner reads own; admin all.

   - affiliate_referrals: id, affiliate_id FK, referred_user_id FK UNIQUE, created_at. Policies: affiliate reads own referrals; admin all.

   - payments (structure for Stripe now; keys come later): id, user_id FK, stripe_checkout_session_id text UNIQUE, stripe_payment_intent_id text, amount_cents int, currency text DEFAULT 'usd', purpose text CHECK IN ('pod','membership_annual','membership_monthly'), status text CHECK IN ('pending','paid','failed','refunded') DEFAULT 'pending', metadata jsonb, created_at. Policies: user reads own; admin all.

5. No function may be SECURITY DEFINER without an explicit comment why; search_path fixed on all functions.



## Structure for Stripe (keys arrive later - DO NOT invent keys)

Create a central config/edge-function scaffold for Stripe checkout (pod $500, membership $999/year with coupon support) that reads keys from Supabase secrets (STRIPE_SECRET_KEY etc. as unset placeholders). No real Stripe calls yet - just the clean seam so wiring keys later is a config change, not a refactor.



## Definition of done for this phase

- New Google user can sign in, complete onboarding, land in the branded shell, see the Events placeholder, and sign out.

- The migration applies cleanly from scratch; RLS proven on every table; all listed indexes exist.

- Zero hardcoded hex colors or pure-white backgrounds in components.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oka-family-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a83c2bba-a8ee-42e5-93e1-18ab76f82c8a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
