# Backroom v1.00 — Country Location Scope Checklist

Baseline / rollback point: the uploaded `app.js` and `calendar.js` before this country-scope pass.

Files changed:
- `app.js`
- `calendar.js`

## What changed

- Location now supports three scopes:
  - All Cities
  - One country
  - One city, optionally limited to its country
- Country matching is dynamic from the existing `Country` fields in `listings.json`. No hard-coded country list was added.
- A country can be entered in the Country box with City blank.
- A country name entered in the City box is also recognised as a country scope when it does not match a real city in the current directory.
- Search Results, Venues, and Events now use the same saved country/city scope.
- The Events location selector now includes country choices as well as city choices.

## Test checklist

| # | Test | Expected result | Pass / notes |
|---|---|---|---|
| 1 | Upload both files and hard refresh. | Sidebar shows `v1.00`. | |
| 2 | Location popup: enter `Albania` in **Country**, leave City blank, save. | Button says `Show Results in Albania`; Search Results shows `RESULTS IN ALBANIA`. | |
| 3 | Open Venues after the Albania location is saved. | Heading says `VENUES IN ALBANIA`; every Albanian venue is shown. | |
| 4 | Open Events after the Albania location is saved. | Heading says `EVENTS IN ALBANIA`; only events linked to Albanian venues are shown. | |
| 5 | Location popup: clear Country, type `Albania` in **City**, save. | It is treated as a country scope, not a nonexistent city. | |
| 6 | Location popup: set Country `Albania` and City `Tirana`. | Results, Venues, and Events show Tirana only. | |
| 7 | Calendar Location selector. | It contains an `All [country]` option for every country currently represented in the directory, plus the existing city choices. | |
| 8 | Pick a country from the calendar selector. | The saved Location updates, the Events heading changes to that country, and Search Results/Venues follow the same scope. | |
| 9 | Set City `Berlin` as before. | Existing city-only behaviour still works. | |
| 10 | Clear Location. | Search Results and Venues return to all cities; Events returns to `EVENTS`. | |
