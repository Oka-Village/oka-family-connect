# Open Accounting: Stripe-এর সাথে মিলিয়ে তারপর দেখানো

## লক্ষ্য
Open Accounting পেজ খুললে আগে Stripe-এর আসল পেমেন্টের সাথে মেলানো হবে। কোনো পেমেন্ট বাদ পড়লে, স্ট্যাটাস ভুল থাকলে বা রিফান্ড/ফি না থাকলে আগে সেটা ঠিক হবে, তারপর পেজে সংখ্যাগুলো দেখাবে।

## ধাপগুলো
1. **Stripe পড়া** — সফল সব পেমেন্ট, রিফান্ড আর প্রসেসিং ফি নেওয়া হবে।
2. **রেকর্ডের সাথে তুলনা** — প্রতিটা পেমেন্ট মেলানো হবে, যাতে একটা পেমেন্ট একবারই গোনা হয়।
3. **গরমিল ঠিক করা**
   - Stripe-এ আছে কিন্তু আমাদের রেকর্ডে নেই → নতুন পেমেন্ট যোগ হবে, ফাউন্ডিং মেম্বারদের মেম্বারশিপ চালু হবে।
   - রেকর্ডে "pending" কিন্তু Stripe-এ সফল → "paid" করা হবে।
   - Stripe-এ রিফান্ড হয়েছে → "refunded" করা হবে।
   - প্রতিটা পেমেন্টে Stripe-এর আসল ফি সেভ হবে, ফলে নিট আয় সঠিক দেখাবে।
   - কোন মেম্বারের পেমেন্ট সেটা মেলানো হবে checkout-এর মেম্বার রেফারেন্স দিয়ে, না পেলে ইমেইল দিয়ে। কাউকে মেলানো না গেলে সেটা অনুমান করে যোগ করা হবে না, শুধু "মেলানো যায়নি" তালিকায় থাকবে।
   - Pod ($175), টেস্ট পেমেন্ট আর বাতিল হওয়া পেমেন্ট মেম্বারশিপে গোনা হবে না।
4. **হিসাব নতুন করে করা** — রেফারেল, আয় আর মাসিক হিসাব আবার চালানো হবে।
5. **পেজ দেখানো** — শেষে "Stripe-এর সাথে মেলানো: সময়" লেখা থাকবে। Stripe-এ সমস্যা হলে পেজ আটকে থাকবে না, আগের রেকর্ড দিয়েই দেখাবে আর একটা নোট দেবে।

## নিরাপত্তা
- এই মেলানোর কাজ সার্ভারে চলবে, Stripe-এর গোপন key কখনো ব্রাউজারে যাবে না।
- শুধু সাইন-ইন করা মেম্বাররাই এটা চালাতে পারবে। বারবার Stripe-এ কল না যাওয়ার জন্য প্রতি ৫ মিনিটে সর্বোচ্চ একবার চলবে।
- পুরো কাজটা আবার চালালেও কোনো পেমেন্ট দুইবার যোগ হবে না।

## Technical details
- New `src/lib/stripe/reconcile.server.ts`: list PaymentIntents/charges/balance transactions with pagination, classify by line-item/amount (founding $250, pod), and resolve users via checkout session `client_reference_id`, then auth email match.
- New `src/lib/stripe/reconcile.functions.ts`: `reconcileOpenAccounting` server fn with `requireSupabaseAuth`, using the admin client inside the handler; upsert keyed on `stripe_payment_intent_id`; write `processing_fee_cents` into metadata; call `sync_member_earnings` and `sync_open_accounting`. Throttle with a last-run timestamp; the table for it is a small migration only if no existing place fits.
- Update `src/data/open-accounting/live-ledger.ts`: call the reconcile fn before `open_accounting_raw`, and return `reconciledAt` and an unmatched count.
- Small UI note in `open-accounting-books.tsx` showing the last Stripe check time.
- Tests: pure matching/classification logic (founding vs pod vs test, refund → refunded, idempotent second run).
