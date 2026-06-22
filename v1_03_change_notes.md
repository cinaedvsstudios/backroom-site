# Backroom v1.03 — Location and Cruising Area Styles

Files included:
- `app.js`
- `index.html`
- `style.css`
- `admin.js`

Changes:
1. The Location popup now has one field: `Paris`, `France`, or `Paris, France`.
2. Country-only and city-only saved scopes still use the existing `City` and `Country` listing data.
3. Category `Cruising Area` now renders with a dark-red card and bright red outline.
4. Every listing tagged `Men Only` renders with a bright red outline but keeps the normal dark card background.
5. Admin Category dropdown now includes `Cruising Area`.

Quick checks:
- Enter `France`, then open Results, Venues, and Events.
- Enter `Paris, France`, then check that only Paris records appear.
- Add a test record with `Category: Cruising Area`, `Feature_Cruise_Focused: true`, and `Vibe_Tags` including `Cruising`; confirm the dark-red card.
- Confirm a genuine men-only venue with `Men Only` has the red outline only.
