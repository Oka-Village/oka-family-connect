# Fix "Offer a skill" page on mobile

## Problem
On phones, the title box, photo button and other fields stick out past the right edge of the white card.

## Fix
- Keep every field inside the card on small screens.
- Make the "Session format" pill buttons wrap onto a new line instead of pushing the card wider.
- Put the photo button below the photo square on very narrow phones.
- Use a little less padding around the page and card on phones.
- The Edit skill page uses the same form, so it gets fixed too.
- Desktop layout stays the same.

## Technical details
- `skill-form.tsx`: add `min-w-0` to the form grid and its children, change the format row from `flex` to `flex flex-wrap`, give the photo row `flex-wrap`, and use padding `p-5 sm:p-6`.
- `skills.new.tsx` / `skills.edit.$skillId.tsx`: use page padding `px-5 sm:px-6`.
- Check with Playwright at 360, 375 and 394px widths that nothing goes wider than the screen.
