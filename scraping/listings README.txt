BACKROOM VENUES — ZONE FILES
==============================

Source file: listings.json
Source records: 168

The seven .json files are strict JSON arrays and can be placed directly in the scraper folder.
No in-file comments were added because standard JSON does not allow comments and adding them can break a JSON parser.
The zone coverage is encoded in each filename and listed below.

listings_zone_0_germany.json
  Zone 0 — Germany
  Coverage: Germany: Berlin, Hamburg, Cologne, Frankfurt, Munich, Stuttgart and Germany-wide/rotating venue or party brands.
  Listings: 157

listings_zone_1_france_benelux_netherlands.json
  Zone 1 — France, Benelux & Netherlands
  Coverage: France, Belgium, Netherlands and Amsterdam: Paris, Marseille, Bordeaux, Montpellier, Lyon, Brussels, Antwerp and Amsterdam.
  Listings: 4

listings_zone_2_uk_ireland.json
  Zone 2 — UK & Ireland
  Coverage: United Kingdom and Ireland: London, Manchester, Brighton, Dublin and related locations.
  Listings: 1

listings_zone_3_iberia_portugal_islands.json
  Zone 3 — Iberia, Portugal & Islands
  Coverage: Spain, Portugal and island destinations: Madrid, Barcelona, Valencia, Torremolinos, Sitges, Ibiza, Maspalomas/Playa del Inglés and Lisbon.
  Listings: 2

listings_zone_4_italy_alps_mediterranean_central_europe.json
  Zone 4 — Italy, Alps, Mediterranean & Central Europe
  Coverage: Italy, Switzerland, Austria, Greece, Mykonos, Prague and Budapest: Rome, Milan, Zurich, Vienna, Athens, Mykonos, Prague and Budapest.
  Listings: 2

listings_zone_5_poland_nordics_baltics.json
  Zone 5 — Poland, Nordics & Baltics
  Coverage: Poland, Denmark, Sweden, Finland, Estonia, Latvia and Lithuania: Warsaw, Poznań, Wrocław, Gdańsk, Krakow, Copenhagen, Stockholm, Helsinki, Tallinn, Riga and Vilnius.
  Listings: 1

listings_zone_6_other_unassigned.json
  Zone 6 — Other / Unassigned
Zone 6 — Everything Else / Low-Priority Updates
Coverage: Any listing outside the routine Zones 0–5 coverage, including lower-priority cities, smaller destinations, countries without a dedicated zone, Northern Africa, nearby Mediterranean/Middle East/Caucasus destinations, and cross-zone or international touring brands that cannot belong in one city file without duplication.

This is the lower-frequency update file. It can grow gradually and does not need the same regular scrape cycle as Zones 0–5.

Balkans & South-East Europe:
Albania — Tirana
Bosnia and Herzegovina — Sarajevo, Banja Luka
Bulgaria — Sofia, Plovdiv, Varna
Croatia — Zagreb, Split, Dubrovnik, Hvar
Kosovo — Pristina
Montenegro — Podgorica, Budva, Kotor
North Macedonia — Skopje, Ohrid
Romania — Bucharest, Cluj-Napoca, Timișoara, Brașov
Serbia — Belgrade, Novi Sad
Slovenia — Ljubljana, Maribor

Remaining Central & Eastern Europe:
Belarus — Minsk
Moldova — Chișinău
Slovakia — Bratislava, Košice
Ukraine — Kyiv, Lviv, Odesa
Ukraine should be expanded or refreshed only when current venue activity and travel conditions can be verified.

Secondary destinations from otherwise covered countries:
Greece — Thessaloniki, Corfu, Santorini, Heraklion
Other smaller or occasional destinations can sit here where they are not part of the normal high-priority city update cycle.

Nordic & North Atlantic remainder:
Norway — Oslo, Bergen, Trondheim, Tromsø
Iceland — Reykjavík
Faroe Islands — Tórshavn
Greenland — Nuuk

Microstates, territories & nearby Europe:
Andorra — Andorra la Vella
Cyprus — Nicosia, Limassol, Larnaca, Paphos, Ayia Napa
Gibraltar — Gibraltar
Liechtenstein — Vaduz
Malta — Valletta, St Julian’s, Sliema
Monaco — Monaco
San Marino — San Marino
Vatican City — Vatican City

Caucasus, Turkey & nearby Middle East:
Armenia — Yerevan
Azerbaijan — Baku
Georgia — Tbilisi, Batumi
Israel — Tel Aviv, Jerusalem, Eilat
Jordan — Amman, Aqaba
Lebanon — Beirut
Turkey — Istanbul, İzmir, Antalya, Bodrum

Northern Africa:
Algeria — Algiers, Oran
Egypt — Cairo, Alexandria, Hurghada, Sharm El Sheikh
Libya — Tripoli
Morocco — Marrakech, Agadir, Casablanca, Rabat, Tangier
Tunisia — Tunis, Hammamet, Sousse, Djerba
Western Sahara — Dakhla, Laayoune

Cross-zone and international touring brands:
Country: Europe or International, as appropriate.
City: List only currently verified host cities.
Leave Address, Postcode, Nearest_Station, Latitude and Longitude blank unless the party has a permanent home venue.
Keep the parent listing here once only; city-specific dated editions belong in the relevant city’s event file where practical.

Rule:
Any lower-priority city, country or destination not actively maintained in Zones 0–5 can be placed in Zone 6.
Do not duplicate a fixed venue or touring parent across multiple zone files.