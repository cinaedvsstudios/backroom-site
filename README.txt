BACKROOM v0.68 — NAVIGATION UPDATE

Replace the repository root app.js with this file.

Changes:
- Adds Search Results above Venues in the sidebar.
- Venues now shows all live venues in the saved Location city; with no saved city, it shows all venues.
- Changes the Venues emoji to 🏢.
- Renames the Calendar sidebar item to Events and places it directly after Venues; it remains the same calendar page.
- Moves My Events beside Favourites in the top bar and removes it from the sidebar.
- Hides Travel and its dropdown from the sidebar without deleting travel data/code.
- Back to Search Results keeps the existing query rather than clearing it.

Because the current index.html still cache-busts app.js using ?v=0.66, hard-refresh once after upload (Ctrl+F5) if the old menu remains visible.
