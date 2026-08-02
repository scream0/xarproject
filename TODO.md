# TODO — Fix reversed About/Product image upload

## Goal
The admin "image upload" currently controls a big image shown above the Product cards in the landing page, and lives in the Store ("Toko") tab. It should instead live in the **About** tab and control the image shown in the **About** section of the landing page.

## Steps
- [x] 1. `src/app/api/settings/route.js` — add `imagePublicId` to `about` in `DEFAULT_SETTINGS` + PUT handling.
- [x] 2. `src/data/ui/settingsConfig.json` — relabel `productSectionImage` → `aboutImage`, `productSectionImageAlt` → `aboutImageAlt`; update sections/placeholders.
- [x] 3. `src/components/Dashboard/Admin/Settings/SettingsView.js` — move file-upload UI from Store tab → About tab; update state mapping + save payload to use `about.image` / `about.imagePublicId`.
- [x] 4. `src/components/Product/Product.js` — remove the featured-image block above product cards.
- [x] 5. Verify landing & admin settings (About.js already renders `about.image` correctly).

