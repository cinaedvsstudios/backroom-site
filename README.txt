# Backroom v0.67 — Weekly Event Recurrence

Install: replace the repository’s existing app.js and admin.js with these files. Do not replace events.json with the example template.

Weekly events only:
- Recurrence_Type: Weekly
- Recurrence_Day: Monday through Sunday
- Recurrence_Until: optional YYYY-MM-DD expiry date
- Event_Date: first known valid occurrence / start date

The public site calculates and displays the next weekly occurrence automatically. Monthly events stay as individual dated rows, one record per occurrence.
