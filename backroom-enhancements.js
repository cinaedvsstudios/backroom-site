/* Backroom enhancement layer v1.02
   Loaded after app.js and calendar.js. It keeps the existing data schema intact while:
   - replacing the visible Country + City controls with one Location field,
   - preserving old saved locations,
   - keeping GPS, map and postcode behaviour,
   - applying specialised placeholder images,
   - styling Men Only and Cruising Area venue cards,
   - protecting duplicate-city selection inside the Calendar.
*/
(() => {
    'use strict';

    if (window.__backroomEnhancementLayerV102) return;
    window.__backroomEnhancementLayerV102 = true;

    const PLACEHOLDER = Object.freeze({
        standard: 'placeholder_venue.jpg',
        pride: 'placeholder_venue11.jpg',
        cruiseIndoor: 'placeholder_venue12.jpg',
        cruiseOutdoor: 'placeholder_venue13.jpg',
        sauna: 'placeholder_venue14.jpg'
    });

    let venues = [];
    let events = [];
    let loaded = false;
    let controlsBound = false;
    let patchBound = false;
    let applyQueued = false;

    const normalise = value => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');

    const tags = value => [...new Set(String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean))];

    const publicVenue = venue => !['hold', 'flag'].includes(String(venue?.Status || '').trim().toLowerCase());
    const isCruisingArea = venue => String(venue?.Category || '').trim().toLowerCase() === 'cruising area';
    const isMenOnly = venue => tags(venue?.Vibe_Tags).includes('Men Only');
    const isPrideEvent = (event, venue) => tags(event?.Vibe_Tags).includes('Pride') || tags(venue?.Vibe_Tags).includes('Pride');

    const firstCity = item => String(item?.City || '')
        .split(',')
        .map(city => city.trim())
        .filter(Boolean)[0] || '';

    const cityTokens = item => String(item?.City || '')
        .split(',')
        .map(city => city.trim())
        .filter(Boolean);

    function notify(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else {
            window.alert(message);
        }
    }

    function venueById(id) {
        return venues.find(venue => String(venue?.Venue_ID || '') === String(id || '')) || null;
    }

    function eventByName(name) {
        const wanted = normalise(String(name || '').replace(/\u2011/g, '-'));
        if (!wanted) return null;
        return events.find(event => normalise(String(event?.Event_Name || '').replace(/\u2011/g, '-')) === wanted) || null;
    }

    function eventForCard(card) {
        const eventId = String(card?.dataset?.brEventId || '').trim();
        if (eventId) {
            return events.find(event => String(event?.Event_ID || '') === eventId) || null;
        }
        return eventByName(card?.querySelector('.card-title, .calendar-event-name')?.textContent || '');
    }

    function cruisingAreaFallback(venue) {
        const haystack = normalise([
            venue?.Name,
            venue?.Description,
            venue?.Address,
            venue?.Native_Map_Query
        ].filter(Boolean).join(' '));

        const indoorSignals = [
            'toilet', 'toilets', 'bathroom', 'bathrooms', 'restroom', 'restrooms',
            'urinal', 'urinals', 'publicwc', 'station', 'railway'
        ];

        return indoorSignals.some(signal => haystack.includes(signal))
            ? PLACEHOLDER.cruiseIndoor
            : PLACEHOLDER.cruiseOutdoor;
    }

    function venueFallback(venue) {
        if (isCruisingArea(venue)) return cruisingAreaFallback(venue);
        if (String(venue?.Category || '').trim().toLowerCase() === 'sauna') return PLACEHOLDER.sauna;
        return PLACEHOLDER.standard;
    }

    function venueSource(venue) {
        const explicit = String(venue?.Image_URL || '').trim();
        if (explicit) return explicit;
        const id = String(venue?.Venue_ID || '').trim();
        return id ? `Venue_images/${id}-01.jpg` : venueFallback(venue);
    }

    function eventSource(event, venue) {
        const explicit = String(event?.Event_Image_URL || '').trim();
        if (explicit) return explicit;

        // Pride uses its own event visual when no dedicated event image has been supplied,
        // rather than inheriting the linked venue image.
        if (isPrideEvent(event, venue)) return PLACEHOLDER.pride;
        return venueSource(venue || {});
    }

    function setImage(image, source, fallback) {
        if (!image) return;

        const chosenSource = String(source || fallback || PLACEHOLDER.standard);
        const chosenFallback = String(fallback || PLACEHOLDER.standard);

        if (image.dataset.brEnhancedSource !== chosenSource) {
            image.dataset.brEnhancedSource = chosenSource;
            image.dataset.brFallbackActive = 'false';
            image.dataset.brDisableCarousel = 'false';
            image.src = chosenSource;
        }

        image.dataset.brEnhancedImage = 'true';
        image.onerror = () => {
            if (image.dataset.brFallbackActive === 'true') return;
            image.dataset.brFallbackActive = 'true';
            image.dataset.brDisableCarousel = 'true';
            image.src = chosenFallback;
        };
    }

    function addCardClass(card, venue) {
        if (!card || !venue) return;
        const cruising = isCruisingArea(venue);
        card.classList.toggle('card--cruising-area', cruising);
        card.classList.toggle('card--men-only', !cruising && isMenOnly(venue));
    }

    function applyVenueCards(root = document) {
        root.querySelectorAll?.('.venue-image[data-id], #modal-venue-image[data-id]').forEach(image => {
            const venue = venueById(image.dataset.id);
            if (!venue) return;

            addCardClass(image.closest('.card'), venue);
            setImage(image, venueSource(venue), venueFallback(venue));
        });
    }

    function applyEventCards(root = document) {
        root.querySelectorAll?.('.search-result-event-card, .calendar-event-card').forEach(card => {
            const event = eventForCard(card);
            if (!event) return;
            const venue = venueById(event.Venue_ID);
            const image = card.querySelector('.venue-image, .calendar-venue-thumb');
            const fallback = isPrideEvent(event, venue) ? PLACEHOLDER.pride : venueFallback(venue);
            setImage(image, eventSource(event, venue), fallback);
        });
    }

    function applyEverything(root = document) {
        applyVenueCards(root);
        applyEventCards(root);
        repairCalendarLocationLabels(root);
    }

    function queueApply(root = document) {
        if (applyQueued) return;
        applyQueued = true;
        window.requestAnimationFrame(() => {
            applyQueued = false;
            applyEverything(root);
        });
    }

    function installStyles() {
        if (document.getElementById('backroom-enhancement-layer-styles')) return;

        const style = document.createElement('style');
        style.id = 'backroom-enhancement-layer-styles';
        style.textContent = `
            #location-legacy-fields { display: none !important; }

            .card.card--men-only {
                border: 2px solid var(--bright-red-orange, #d55036);
            }

            .card.card--cruising-area {
                border: 2px solid var(--bright-red-orange, #d55036);
                background: linear-gradient(180deg, var(--panel-dark, #1f2535) 0%, #3a1014 100%);
            }

            .card.card--cruising-area .card-inner-content {
                background: rgba(81, 9, 16, .22);
            }

            .card.card--men-only.selected,
            .card.card--cruising-area.selected {
                border-color: var(--bright-red-orange, #d55036);
                box-shadow: 0 0 0 2px rgba(44, 168, 212, .48), 0 0 22px rgba(44, 168, 212, .30);
            }
        `;
        document.head.appendChild(style);
    }

    function buildLocationIndex() {
        const countries = new Map();
        const cityEntries = new Map();

        venues.forEach(venue => {
            const country = String(venue?.Country || '').trim();
            const countryKey = normalise(country);
            if (country && countryKey && !countries.has(countryKey)) countries.set(countryKey, country);

            cityTokens(venue).forEach(city => {
                const cityKey = normalise(city);
                if (!cityKey) return;
                const entries = cityEntries.get(cityKey) || [];
                if (!entries.some(entry => normalise(entry.city) === cityKey && normalise(entry.country) === countryKey)) {
                    entries.push({ city, country });
                }
                cityEntries.set(cityKey, entries);
            });
        });

        return { countries, cityEntries };
    }

    function resolveLocation(text) {
        const raw = String(text || '').trim();
        if (!raw) {
            return { valid: true, scope: 'all', city: '', country: '', label: 'All Cities' };
        }

        if (!loaded) {
            return { valid: false, message: 'Location data is still loading. Try again in a moment.' };
        }

        const { countries, cityEntries } = buildLocationIndex();
        const pieces = raw.split(',').map(piece => piece.trim()).filter(Boolean);

        if (pieces.length >= 2) {
            const requestedCity = pieces.slice(0, -1).join(', ');
            const requestedCountry = pieces.at(-1);
            const country = countries.get(normalise(requestedCountry));
            const matches = cityEntries.get(normalise(requestedCity)) || [];
            const match = matches.find(candidate => normalise(candidate.country) === normalise(country));

            if (match) {
                return {
                    valid: true,
                    scope: 'city',
                    city: match.city,
                    country: match.country,
                    label: `${match.city}, ${match.country}`
                };
            }

            return { valid: false, message: 'Use a recognised City, Country pair from the directory.' };
        }

        const cityMatches = cityEntries.get(normalise(raw)) || [];
        const countryMatch = countries.get(normalise(raw)) || '';

        // Where a spelling is both a city and a country, city is the safer default.
        if (cityMatches.length === 1) {
            const match = cityMatches[0];
            return {
                valid: true,
                scope: 'city',
                city: match.city,
                country: match.country,
                label: `${match.city}, ${match.country}`
            };
        }

        if (cityMatches.length > 1) {
            return { valid: false, message: `More than one ${raw} is listed. Enter City, Country.` };
        }

        if (countryMatch) {
            return { valid: true, scope: 'country', city: '', country: countryMatch, label: countryMatch };
        }

        return { valid: false, message: 'Choose a city or country that is already in the directory.' };
    }

    function locationInput() {
        return document.getElementById('loc-location');
    }

    function legacyCityInput() {
        return document.getElementById('loc-city');
    }

    function legacyCountryInput() {
        return document.getElementById('loc-country');
    }

    function currentLocation() {
        try {
            const stored = JSON.parse(localStorage.getItem('br_location') || 'null');
            if (!stored || typeof stored !== 'object') return { scope: 'all', city: '', country: '', postcode: '' };

            const city = String(stored.city || '').trim();
            const country = String(stored.country || '').trim();
            const postcode = String(stored.postcode || '').trim();

            if (city) return { scope: 'city', city, country, postcode };
            if (country) return { scope: 'country', city: '', country, postcode };
            return { scope: 'all', city: '', country: '', postcode: '' };
        } catch {
            return { scope: 'all', city: '', country: '', postcode: '' };
        }
    }

    function locationLabel(location) {
        if (location?.scope === 'city') return location.country ? `${location.city}, ${location.country}` : location.city;
        if (location?.scope === 'country') return location.country;
        return '';
    }

    function syncLegacy(location, coordinates = null) {
        const city = legacyCityInput();
        const country = legacyCountryInput();

        if (city) {
            city.value = location?.city || '';
            if (coordinates) {
                city.dataset.lat = String(coordinates.lat ?? '');
                city.dataset.lon = String(coordinates.lon ?? '');
            }
        }
        if (country) country.value = location?.country || '';
    }

    function updateLocationReadout(location = currentLocation()) {
        const display = document.getElementById('current-location-display');
        if (!display) return;

        const label = locationLabel(location);
        display.textContent = label ? `Current: ${label}` : 'No location set.';
    }

    function updateSaveButton() {
        const button = document.getElementById('btn-save-location');
        const input = locationInput();
        if (!button || !input) return;

        const resolution = resolveLocation(input.value);
        button.textContent = !input.value.trim()
            ? 'Show Results in All Cities'
            : resolution.valid
                ? `Show Results in ${resolution.label}`
                : 'Show Results';
    }

    function syncVisibleInput() {
        const input = locationInput();
        const saved = currentLocation();

        if (input) input.value = locationLabel(saved);
        syncLegacy(saved);
        updateLocationReadout(saved);
        updateSaveButton();
    }

    function locationInputChanged() {
        const input = locationInput();
        if (!input) return;

        const resolution = resolveLocation(input.value);
        if (resolution.valid) {
            syncLegacy(resolution, { lat: '', lon: '' });
        } else {
            syncLegacy({ city: '', country: '' }, { lat: '', lon: '' });
        }

        input.dataset.lat = '';
        input.dataset.lon = '';
        updateSaveButton();
    }

    function dispatchLocation(location) {
        window.dispatchEvent(new CustomEvent('backroom:location-changed', { detail: location }));
    }

    function rerenderResults() {
        if (typeof window.updateSearchClearButton === 'function') window.updateSearchClearButton();

        if (window.location.hash === '#results') {
            if (typeof window.handleRouting === 'function') window.handleRouting();
            else window.dispatchEvent(new HashChangeEvent('hashchange'));
        } else {
            window.location.hash = '#results';
        }
    }

    function saveLocation() {
        const input = locationInput();
        const postcode = document.getElementById('loc-postcode')?.value.trim() || '';
        const resolution = resolveLocation(input?.value || '');

        if (!resolution.valid) {
            notify(resolution.message || 'Choose a recognised city or country before saving.');
            return;
        }

        const next = {
            scope: resolution.scope,
            city: resolution.city,
            country: resolution.country,
            postcode: resolution.scope === 'all' ? '' : postcode
        };

        localStorage.setItem('br_location', JSON.stringify(next));
        syncLegacy(next);
        updateLocationReadout(next);
        updateSaveButton();
        dispatchLocation(next);

        const search = document.getElementById('search-input');
        if (search) search.value = '';

        document.getElementById('location-modal')?.classList.add('hidden');
        rerenderResults();
    }

    function clearLocation() {
        localStorage.removeItem('br_location');

        const input = locationInput();
        const postcode = document.getElementById('loc-postcode');
        if (input) {
            input.value = '';
            input.dataset.lat = '';
            input.dataset.lon = '';
        }
        if (postcode) postcode.value = '';

        syncLegacy({ city: '', country: '' }, { lat: '', lon: '' });

        const map = document.getElementById('loc-map');
        const mapPlaceholder = document.getElementById('map-preview-placeholder');
        if (map) map.style.display = 'none';
        mapPlaceholder?.classList.remove('hidden');

        updateLocationReadout();
        updateSaveButton();
        dispatchLocation({ scope: 'all', city: '', country: '', postcode: '' });

        if (window.location.hash === '#results') rerenderResults();
    }

    async function mapSearch() {
        const input = locationInput();
        const postcode = document.getElementById('loc-postcode')?.value.trim() || '';
        const query = `${postcode} ${input?.value.trim() || ''}`.trim();
        if (!query) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const results = await response.json();

            if (results?.[0] && typeof window.initLeafletMap === 'function') {
                window.initLeafletMap(results[0].lat, results[0].lon);
            } else if (!results?.length) {
                window.alert('Location not found on map, but a recognised directory location can still be saved.');
            }
        } catch (error) {
            console.error('Backroom map search failed.', error);
        }
    }

    function useGps() {
        notify('Hold up a few seconds, we are confirming your location.');

        if (!navigator.geolocation) {
            window.alert('Geolocation not supported.');
            return;
        }

        navigator.geolocation.getCurrentPosition(async position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();
                const city = data?.address?.city || data?.address?.town || data?.address?.village || '';
                const country = data?.address?.country || '';

                const input = locationInput();
                if (input) {
                    input.value = city && country ? `${city}, ${country}` : (city || country);
                    input.dataset.lat = String(lat);
                    input.dataset.lon = String(lon);
                }

                syncLegacy({ scope: city ? 'city' : (country ? 'country' : 'all'), city, country }, { lat, lon });
                updateSaveButton();
                if (typeof window.initLeafletMap === 'function') window.initLeafletMap(lat, lon);
            } catch (error) {
                notify('GPS found your coordinates, but could not resolve a city.');
                if (typeof window.initLeafletMap === 'function') window.initLeafletMap(lat, lon);
            }
        }, () => window.alert('GPS denied or unavailable.'));
    }

    function replaceControl(id, listener) {
        const original = document.getElementById(id);
        if (!original || original.dataset.brReplacement === 'true') return;

        const replacement = original.cloneNode(true);
        replacement.dataset.brReplacement = 'true';
        original.replaceWith(replacement);

        replacement.addEventListener('click', event => {
            event.preventDefault();
            listener(event);
        });
    }

    function openLocationPatched() {
        syncVisibleInput();
    }

    function bindLocationControls() {
        if (controlsBound || !locationInput()) return;

        // The current app installs its own legacy field listeners after listings/events arrive.
        // Waiting for this marker preserves that startup sequence before replacing the buttons.
        if (!legacyCityInput()?.dataset?.locationLabelBound) {
            window.setTimeout(bindLocationControls, 100);
            return;
        }

        controlsBound = true;

        const input = locationInput();
        input.addEventListener('input', locationInputChanged);
        input.addEventListener('change', locationInputChanged);

        replaceControl('btn-save-location', saveLocation);
        replaceControl('btn-clear-location', clearLocation);
        replaceControl('btn-search-map', mapSearch);
        replaceControl('btn-gps', useGps);

        document.getElementById('btn-location')?.addEventListener('click', () => {
            window.setTimeout(openLocationPatched, 0);
        });

        const originalOpen = window.openLocationModal;
        if (typeof originalOpen === 'function' && !originalOpen.__brEnhancementWrapped) {
            const wrapped = function (...args) {
                const result = originalOpen.apply(this, args);
                window.setTimeout(openLocationPatched, 0);
                return result;
            };
            wrapped.__brEnhancementWrapped = true;
            window.openLocationModal = wrapped;
        }

        syncVisibleInput();
    }

    function locationMatches(item, scope) {
        if (!scope || scope.scope === 'all') return true;

        const country = String(item?.Country || '').trim();
        if (scope.scope === 'country') {
            return normalise(country) === normalise(scope.country);
        }

        const cityMatch = cityTokens(item).some(city => normalise(city) === normalise(scope.city));
        const countryMatch = !scope.country || normalise(country) === normalise(scope.country);
        return cityMatch && countryMatch;
    }

    function eventLocationMatches(event, linkedVenue, scope) {
        if (!scope || scope.scope === 'all') return true;

        // Linked venue data is primary; event fields are the documented fallback.
        const source = linkedVenue || event || {};
        return locationMatches(source, scope);
    }

    function patchSearchEventScope() {
        if (patchBound || typeof window.getEventDisplayOccurrence !== 'function') return;

        const original = window.getSearchScopeEvents;
        if (typeof original !== 'function') return;

        patchBound = true;

        const enhanced = function (now = new Date()) {
            const scope = currentLocation();
            return events
                .filter(event => !['hold', 'flag', 'closed', 'cancelled', 'canceled'].includes(String(event?.Status || '').trim().toLowerCase()))
                .map(event => {
                    const venue = venueById(event?.Venue_ID);
                    if (!eventLocationMatches(event, venue, scope)) return null;

                    const occurrence = window.getEventDisplayOccurrence(event, now);
                    if (!occurrence || occurrence.Is_Past) return null;
                    return { event: occurrence, venue };
                })
                .filter(Boolean)
                .sort((left, right) => {
                    if (typeof window.compareEventOccurrences === 'function') {
                        return window.compareEventOccurrences(left.event, right.event);
                    }
                    return String(left.event?.Display_Date || left.event?.Event_Date || '').localeCompare(String(right.event?.Display_Date || right.event?.Event_Date || ''));
                });
        };

        enhanced.__brEnhancementWrapped = true;
        window.getSearchScopeEvents = enhanced;
    }

    function patchRenderFunctions() {
        if (typeof window.renderListings !== 'function' || typeof window.openVenueModal !== 'function') {
            window.setTimeout(patchRenderFunctions, 100);
            return;
        }

        if (!window.renderListings.__brEnhancementWrapped) {
            const originalRenderListings = window.renderListings;
            const replacement = function (...args) {
                const result = originalRenderListings.apply(this, args);
                queueApply(args[2] || document);
                return result;
            };
            replacement.__brEnhancementWrapped = true;
            window.renderListings = replacement;
        }

        if (!window.openVenueModal.__brImageEnhancementWrapped) {
            const originalOpenVenueModal = window.openVenueModal;
            const replacement = function (venue, ...args) {
                const result = originalOpenVenueModal.call(this, venue, ...args);
                window.setTimeout(() => {
                    const image = document.getElementById('modal-venue-image');
                    if (image && venue) {
                        image.dataset.id = String(venue.Venue_ID || '');
                        setImage(image, venueSource(venue), venueFallback(venue));
                    }
                    queueApply(document.getElementById('venue-modal') || document);
                }, 0);
                return result;
            };
            replacement.__brImageEnhancementWrapped = true;
            window.openVenueModal = replacement;
        }

        if (typeof window.renderSearchEventResults === 'function' && !window.renderSearchEventResults.__brEnhancementWrapped) {
            const originalRenderSearchEventResults = window.renderSearchEventResults;
            const replacement = function (items, targetContainer, ...args) {
                const container = targetContainer || document.getElementById('results-container');
                const before = new Set(container ? [...container.querySelectorAll('.search-result-event-card')] : []);
                const result = originalRenderSearchEventResults.call(this, items, targetContainer, ...args);
                const created = container
                    ? [...container.querySelectorAll('.search-result-event-card')].filter(card => !before.has(card))
                    : [];

                created.forEach((card, index) => {
                    const event = items?.[index]?.event;
                    if (event?.Event_ID) card.dataset.brEventId = String(event.Event_ID);
                });

                queueApply(container || document);
                return result;
            };
            replacement.__brEnhancementWrapped = true;
            window.renderSearchEventResults = replacement;
        }
    }

    function calendarDuplicateEntries() {
        const seen = new Map();
        venues.forEach(venue => {
            const country = String(venue?.Country || '').trim();
            cityTokens(venue).forEach(city => {
                const key = normalise(city);
                if (!key) return;
                const entries = seen.get(key) || [];
                if (!entries.some(entry => normalise(entry.city) === normalise(city) && normalise(entry.country) === normalise(country))) {
                    entries.push({ city, country });
                }
                seen.set(key, entries);
            });
        });
        return seen;
    }

    function repairCalendarLocationLabels(root = document) {
        const select = root.querySelector?.('#calendar-location-select');
        if (!select || select.dataset.brCalendarEnhanced === 'true' || !loaded) return;

        const duplicates = calendarDuplicateEntries();
        let needsRepair = false;

        [...select.options].forEach(option => {
            if (!option.value.startsWith('city::')) return;
            const city = option.value.slice('city::'.length);
            const matches = duplicates.get(normalise(city)) || [];
            if (matches.length <= 1) return;

            // Existing calendar code stores only a city inside option.value. The custom data
            // lets the capture handler below save the correct matching country.
            option.dataset.brCity = city;
            option.dataset.brCountry = matches[0]?.country || '';
            option.textContent = `${city}, ${matches[0]?.country || ''}`.replace(/,\s*$/, '');
            needsRepair = true;
        });

        if (!needsRepair) {
            select.dataset.brCalendarEnhanced = 'true';
            return;
        }

        select.dataset.brCalendarEnhanced = 'true';
        select.addEventListener('change', event => {
            const option = event.target.selectedOptions?.[0];
            if (!option?.dataset?.brCity || !option.dataset.brCountry) return;

            // Calendar's own handler runs next and initially chooses a city-only match.
            // Correct it immediately afterwards with the explicit City + Country scope.
            window.setTimeout(() => {
                if (typeof window.setBackroomSharedLocation === 'function') {
                    window.setBackroomSharedLocation({
                        scope: 'city',
                        city: option.dataset.brCity,
                        country: option.dataset.brCountry,
                        postcode: ''
                    });
                } else {
                    const next = { scope: 'city', city: option.dataset.brCity, country: option.dataset.brCountry, postcode: '' };
                    localStorage.setItem('br_location', JSON.stringify(next));
                    dispatchLocation(next);
                }

                if (typeof window.openCalendarScreen === 'function' && window.location.hash === '#calendar') {
                    window.openCalendarScreen();
                }
            }, 0);
        });
    }

    function interceptSpecialPlaceholderCarousel() {
        // A special fallback should not turn into a random generic placeholder merely because
        // someone taps it. This only blocks the carousel once the special fallback is active.
        document.addEventListener('click', event => {
            const image = event.target.closest?.('img[data-br-disable-carousel="true"]');
            if (!image) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
    }

    async function loadDirectory() {
        try {
            const [venueResponse, eventResponse] = await Promise.all([
                fetch(`listings.json?v=${Date.now()}`, { cache: 'no-store' }),
                fetch(`events.json?v=${Date.now()}`, { cache: 'no-store' })
            ]);

            if (venueResponse.ok) venues = await venueResponse.json();
            if (eventResponse.ok) events = await eventResponse.json();
        } catch (error) {
            console.warn('Backroom enhancement layer could not load current directory data.', error);
        } finally {
            loaded = Array.isArray(venues) && venues.length > 0;
            bindLocationControls();
            patchSearchEventScope();
            patchRenderFunctions();
            queueApply();
        }
    }

    function initialise() {
        installStyles();
        interceptSpecialPlaceholderCarousel();

        const observer = new MutationObserver(() => queueApply());
        observer.observe(document.documentElement, { childList: true, subtree: true });

        window.addEventListener('backroom:location-changed', () => {
            window.setTimeout(syncVisibleInput, 0);
        });

        loadDirectory();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise, { once: true });
    } else {
        initialise();
    }
})();