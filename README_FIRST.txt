BACKROOM LOCATION + PLACEHOLDER UPDATE
=======================================

This ZIP applies the combined update discussed in chat:

• Country + City becomes one visible Location field.
• Recognised input works as City, Country; City; Country; or blank for All Cities.
• Existing saved locations are preserved and shown in the new field.
• GPS, postcode and map lookup remain available.
• Saving a location clears the normal free-text venue search.
• Main event searches also use event-level City/Country fallback where the venue link is incomplete.
• The Calendar corrects duplicate city choices to City, Country.
• Men Only venue cards get a red outline.
• Cruising Area cards get the stronger red outline + dark-red body.
• Cruising Areas use placeholder 12 for toilets/bathrooms and 13 for outdoor locations when no usable image exists.
• Saunas use placeholder 14 when no usable image exists.
• Pride events use placeholder 11 when no dedicated Event_Image_URL exists.
• Admin View Record uses the same Men Only / Cruising Area visual treatment.

HOW TO APPLY
------------
1. Extract this ZIP directly inside your local Backroom-site project folder.
2. Double-click Run_Backroom_Update.bat.
3. The script checks the expected live files before writing anything.
4. It creates a rollback folder before changing index.html or admin-record-preview.html.
5. Review and commit these four files in GitHub Desktop:

   index.html
   admin-record-preview.html
   backroom-enhancements.js
   admin-record-preview-enhancements.js

DO NOT DELETE
-------------
Keep placeholder_venue11.jpg through placeholder_venue14.jpg in the project root. The update expects exactly those filenames.

ROLLBACK
--------
The script creates a folder named:

backroom_update_rollback_YYYYMMDD-HHMMSS

Copy index.html and admin-record-preview.html back from that folder, then delete the two enhancement JS files if you want to undo this pass.
