Backroom v0.59 fixed package

This package contains repaired v0.59 files based on the approved stabilization plan.

Included:
- index.html
- app.js
- style.css
- admin.html
- admin.js
- system_info.json
- listings.json
- events.json
- Profile_images/avatar_list.json
- about.html
- discounts.html
- cruising-guide.html
- template.html
- thanks.html

Important asset note:
The v0.59 placeholder logic references placeholder_venue08.jpg and placeholder_venue10.jpg for Shop and Cinema fallbacks. These image files were not present in the uploaded code folder, so upload those assets to the same folder as the other placeholder_venue images before relying on those fallbacks.

What was fixed/added:
- Removed old 10+ search tag popup code and localStorage warning toggle.
- Updated version references to v0.59 and cache busting to app.js/style.css v0.59.
- Added shared getVenueTags() and unified tag color mapping.
- Uses Feature_Playroom as Featured Level marker; no Featured_Level field was added.
- Hides Hold/Flag venues from public views/routes.
- Adds Results sidebar route separately from Home.
- Adds Featured page logic using Feature_Playroom values 1/2/3.
- Adds FormSubmit AJAX with thanks toast and small thanks.html fallback popup.
- Adds dynamic avatar filters from Profile_images/avatar_list.json category arrays.
- Adds admin Show All / Pending / Review Old / Show Flag-Hold base filters.
- Adds admin Feature_Playroom Featured Level handling.
- Adds admin Load button for standalone HTML pages.
- Adds standalone static pages.

Caution:
This was repaired from the supplied old/new files without running the app in a browser, so test before deploying publicly.
