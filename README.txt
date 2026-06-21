Backroom Admin v0.69 — Save-to-Repository Export

Replace the repository root admin.js with this file.

What changes:
- Export JSON now opens the operating-system Save dialog in Chrome/Edge.
- Venues suggests listings.json; Events suggests events.json.
- Choose the existing JSON file inside your local Backroom-site folder and confirm Windows overwrite.
- Once saved, GitHub Desktop will see the file change and you can commit/sync normally.
- Export CSV uses the same picker with listings.csv or events.csv.
- Firefox/Safari and any browser without the File System Access API still download the file normally.

Use the individual Export JSON button from the Venues or Events tab. The older Download All button remains a download-only backup tool because browsers cannot reliably open two separate save dialogs from one click.
