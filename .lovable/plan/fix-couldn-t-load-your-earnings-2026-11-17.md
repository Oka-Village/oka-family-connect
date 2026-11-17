# Fix "Couldn't load your earnings"

## What's wrong
The live earnings report still has the old line `min(created_at)` (unqualified). The earlier fix was recorded but the function in the database was not actually replaced, so every load still fails with "created_at is ambiguous" (confirmed in the latest preview requests at 06:21 UTC).

## Fix
One new database change that re-creates `my_earnings_raw()` exactly as it is now, changing only:

```text
min(created_at)::date  ->  min(ar.created_at)::date
```

No app code or UI changes.

## Verify
- Read back the function definition and confirm the line is qualified.
- Call the report as a signed-in member and confirm it returns data.
- Open /earnings in the preview and confirm the error card is gone.
