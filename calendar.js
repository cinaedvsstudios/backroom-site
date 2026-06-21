// Backroom Events calendar — city, date, and vibe filters.
(function () {
    'use strict';

    if (window.__backroomCalendarLoaded) return;
    window.__backroomCalendarLoaded = true;

    const WEEKDAY_INDEX = {
        sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
        wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
        friday: 5, fri: 5, saturday: 6, sat: 6
    };
    const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const EVENT_VIBE_TAGS = [
        'Bar', 'Party', 'Cinema', 'Sauna', 'Shop',
        'Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear',
        'Dancefloor', 'Smoking Area', 'Cocktails',
        'Fetish/Gear', 'Bear', 'Mature', 'Young Crowd', 'Queer', 'Pride', 'Social', 'Drag', 'Karaoke',
        'Pop/Dance', 'Techno'
    ];

    const state = {
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        selectedDate: dateKey(new Date()),
        city: 'All',
        dateFilter: 'all',
        vibeFilter: '',
        events: [],
        venues: [],
        loading: false,
        loaded: false
    };

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function parseDate(value) {
        const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function tagClass(tag) {
        const red = ['Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear', 'Smoking Area', 'Fetish/Gear'];
        const blue = ['Bar', 'Party', 'Cinema', 'Sauna', 'Shop', 'Dancefloor', 'Cocktails', 'Techno', 'Pop/Dance'];
        const yellow = ['Bear', 'Mature', 'Young Crowd', 'Queer', 'Pride', 'Social', 'Drag', 'Karaoke'];
        if (red.includes(tag)) return 'event-filter-red';
        if (yellow.includes(tag)) return 'event-filter-yellow';
        if (blue.includes(tag)) return 'event-filter-blue';
        return 'event-filter-blue';
    }

    function splitTags(value) {
        const seen = new Set();
        return String(value || '')
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => {
                if (!EVENT_VIBE_TAGS.includes(tag) || seen.has(tag)) return false;
                seen.add(tag);
                return true;
            });
    }

    function normalizeCity(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/ß/g, 'ss')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '');
    }

    function readSharedLocation() {
        try {
            const location = JSON.parse(localStorage.getItem('br_location') || 'null');
            if (!location || typeof location !== 'object') return { scope: 'all', city: '', country: '', postcode: '' };
            const city = String(location.city || '').trim();
            const allCities = String(location.scope || '').trim().toLowerCase() === 'all' || !city;
            return allCities ? { scope: 'all', city: '', country: '', postcode: '' } : location;
        } catch {
            return { scope: 'all', city: '', country: '', postcode: '' };
        }
    }

    function availableCityFor(value) {
        const requested = normalizeCity(value);
        if (!requested) return 'All';
        const cities = [...new Set(state.events.map(cityFor).filter(Boolean))];
        return cities.find(city => normalizeCity(city) === requested) || 'All';
    }

    function syncCityFromSharedLocation() {
        const location = readSharedLocation();
        state.city = availableCityFor(location.city);
    }

    function setSharedLocationFromCity(city) {
        const previous = readSharedLocation();
        const next = city === 'All'
            ? { scope: 'all', city: '', country: '', postcode: '' }
            : { scope: 'city', city, country: previous.country || '', postcode: previous.postcode || '' };

        if (typeof window.setBackroomSharedLocation === 'function') {
            window.setBackroomSharedLocation(next);
        } else {
            localStorage.setItem('br_location', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('backroom:location-changed', { detail: next }));
        }
        state.city = city;
    }

    function isWeekly(event) {
        return String(event?.Recurrence_Type || '').trim().toLowerCase() === 'weekly';
    }

    function weeklyDay(event) {
        const key = String(event?.Recurrence_Day || '').trim().toLowerCase();
        return Object.hasOwn(WEEKDAY_INDEX, key) ? WEEKDAY_INDEX[key] : null;
    }

    function recurrenceLabel(event) {
        const day = weeklyDay(event);
        return day === null ? 'Every week' : `Every ${WEEKDAY_LABELS[day]}`;
    }

    function venueFor(event) {
        return state.venues.find(venue => venue.Venue_ID === event.Venue_ID) || null;
    }

    function cityFor(event) {
        const venue = venueFor(event);
        return String(venue?.City || event.City || '').split(',')[0].trim();
    }

    function tagsFor(event) {
        const venue = venueFor(event);
        const combined = [...splitTags(event?.Vibe_Tags), ...splitTags(venue?.Vibe_Tags)];
        return [...new Set(combined)];
    }

    function isPublic(event) {
        const status = String(event?.Status || '').trim();
        if (['Hold', 'Flag', 'Closed', 'Cancelled'].includes(status)) return false;
        if (!event?.Event_Date) return false;
        if (state.city !== 'All' && cityFor(event) !== state.city) return false;
        if (state.vibeFilter && !tagsFor(event).includes(state.vibeFilter)) return false;
        return true;
    }

    function occurrenceForDate(event, targetDate) {
        const firstDate = parseDate(event.Event_Date);
        const untilDate = parseDate(event.Recurrence_Until);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        if (!isWeekly(event)) {
            return firstDate && firstDate.getTime() === target.getTime()
                ? { ...event, Display_Date: dateKey(target), Is_Recurring: false, Recurrence_Label: '' }
                : null;
        }

        const weekday = weeklyDay(event);
        if (weekday === null || !firstDate || target < firstDate || (untilDate && target > untilDate) || target.getDay() !== weekday) return null;
        return { ...event, Display_Date: dateKey(target), Is_Recurring: true, Recurrence_Label: recurrenceLabel(event) };
    }

    function sortEvents(a, b) {
        const dateDiff = String(a.Display_Date || '').localeCompare(String(b.Display_Date || ''));
        if (dateDiff) return dateDiff;
        return String(a.Event_Start_Time || '').localeCompare(String(b.Event_Start_Time || ''));
    }

    function eventsOnDate(key) {
        const target = parseDate(key);
        if (!target) return [];
        return state.events
            .filter(isPublic)
            .map(event => occurrenceForDate(event, target))
            .filter(Boolean)
            .sort(sortEvents);
    }

    function startOfToday() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function endOfThisWeek() {
        const end = startOfToday();
        const daysUntilSunday = (7 - end.getDay()) % 7;
        end.setDate(end.getDate() + daysUntilSunday);
        return end;
    }

    function eventsForActiveDateFilter() {
        if (state.dateFilter === 'all') return eventsOnDate(state.selectedDate);

        const start = startOfToday();
        const end = state.dateFilter === 'today' ? start : endOfThisWeek();
        const output = [];
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            output.push(...eventsOnDate(dateKey(date)));
        }
        return output.sort(sortEvents);
    }

    function eventsForMonth() {
        const year = state.month.getFullYear();
        const month = state.month.getMonth();
        const count = new Date(year, month + 1, 0).getDate();
        const all = [];
        for (let day = 1; day <= count; day += 1) all.push(...eventsOnDate(dateKey(new Date(year, month, day))));
        return all;
    }

    function ensureContainer() {
        let container = document.getElementById('calendar-container');
        if (container) return container;
        container = document.createElement('div');
        container.id = 'calendar-container';
        container.className = 'hidden';
        const wrapper = document.querySelector('#main-content .content-wrapper');
        const filters = document.getElementById('main-filters');
        if (wrapper && filters) wrapper.insertBefore(container, filters);
        else wrapper?.appendChild(container);
        return container;
    }

    function savedEventIds() {
        try { return JSON.parse(localStorage.getItem('br_events')) || []; }
        catch { return []; }
    }

    function monthLabel() {
        return state.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    function selectedLabel() {
        return new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    }

    function activePanelLabel() {
        if (state.dateFilter === 'today') return 'TODAY';
        if (state.dateFilter === 'week') return 'THIS WEEK';
        return selectedLabel();
    }

    function monthCells() {
        const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
        const startOffset = (first.getDay() + 6) % 7;
        const days = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate();
        const cells = Array(startOffset).fill(null);
        for (let day = 1; day <= days; day += 1) cells.push(new Date(state.month.getFullYear(), state.month.getMonth(), day));
        while (cells.length % 7) cells.push(null);
        return cells;
    }

    function ensureSelectedDate() {
        if (state.dateFilter === 'today' || state.dateFilter === 'week') {
            const today = startOfToday();
            state.month = new Date(today.getFullYear(), today.getMonth(), 1);
            state.selectedDate = dateKey(today);
            return;
        }

        const selected = parseDate(state.selectedDate);
        if (!selected || selected.getMonth() !== state.month.getMonth() || selected.getFullYear() !== state.month.getFullYear()) {
            const firstEvent = eventsForMonth().sort(sortEvents)[0];
            state.selectedDate = firstEvent?.Display_Date || dateKey(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
        }
    }

    function renderCityPicker() {
        const cities = [...new Set(state.events.map(cityFor).filter(Boolean))].sort();
        return `<label class="calendar-city-label"><span class="calendar-city-prefix display-font">CITY</span><span class="calendar-city-control"><select id="calendar-city-select" class="calendar-city-select calendar-city-pulse" aria-label="Set the shared city for events and venues">${['All', ...cities].map(city => `<option value="${escapeHTML(city)}" ${state.city === city ? 'selected' : ''}>${escapeHTML(city === 'All' ? 'All cities' : city)}</option>`).join('')}</select></span></label>`;
    }

    function filterChip(label, value, extraClass = '') {
        const isAll = value === 'all';
        const isDate = value === 'today' || value === 'week';
        const isActive = isAll
            ? !state.vibeFilter && state.dateFilter === 'all'
            : isDate
                ? state.dateFilter === value
                : state.vibeFilter === value;
        const className = isDate ? 'event-filter-green' : (isAll ? 'event-filter-all' : tagClass(value));
        return `<button type="button" class="calendar-filter-chip pill-btn ${className} ${isActive ? 'active' : ''} ${extraClass}" data-calendar-filter="${escapeHTML(value)}">${escapeHTML(label)}</button>`;
    }

    function renderFilterStrip() {
        const filters = [
            filterChip('All', 'all'),
            filterChip('Today', 'today'),
            filterChip('This Week', 'week'),
            ...EVENT_VIBE_TAGS.map(tag => filterChip(tag, tag))
        ].join('');
        return `<div class="calendar-filter-shell" aria-label="Event filters"><div class="calendar-filter-scroll"><div class="calendar-filter-grid">${filters}</div></div></div>`;
    }

    function renderGrid() {
        const today = dateKey(new Date());
        const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
        const days = monthCells().map(date => {
            if (!date) return '<div class="calendar-day blank" aria-hidden="true"></div>';
            const key = dateKey(date);
            const count = eventsOnDate(key).length;
            return `<button type="button" class="calendar-day${key === state.selectedDate ? ' selected' : ''}${key === today ? ' today' : ''}${count ? ' has-events' : ''}" data-calendar-date="${key}"><span class="calendar-number">${date.getDate()}</span><span class="calendar-indicators">${count ? `<span class="calendar-dot"></span>${count > 1 ? `<span class="calendar-count">${count}</span>` : ''}` : ''}</span></button>`;
        }).join('');
        return `<div class="calendar-grid">${weekdays}${days}</div>`;
    }

    function renderEventTags(event) {
        const tags = tagsFor(event);
        if (!tags.length) return '';
        return `<div class="calendar-tag-row">${tags.map(tag => `<span class="calendar-tag ${tagClass(tag)}">${escapeHTML(tag)}</span>`).join('')}</div>`;
    }

    function renderEventCard(event, includeDate = false) {
        const venue = venueFor(event);
        const venueName = venue?.Name || 'Venue not listed';
        const location = [venue?.City, venue?.Country].filter(Boolean).join(' · ');
        const times = [event.Event_Start_Time, event.Event_End_Time].filter(Boolean).join(' – ');
        const saved = savedEventIds().includes(event.Event_ID);
        const image = String(event?.Event_Image_URL || venue?.Image_URL || '').trim() || 'placeholder_venue.jpg';
        const dateText = includeDate && event.Display_Date
            ? new Date(`${event.Display_Date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
            : '';
        return `<article class="calendar-event-card"><div class="calendar-event-layout"><div class="calendar-event-media"><img class="calendar-venue-thumb" src="${escapeHTML(image)}" alt="${escapeHTML(venueName)}" onerror="this.onerror=null;this.src='placeholder_venue.jpg';"><button type="button" class="btn primary-btn pill-btn calendar-action ${saved ? 'calendar-saved' : ''}" data-calendar-save="${escapeHTML(event.Event_ID)}">${saved ? '💖 Saved' : '💖 Save Event'}</button>${venue ? `<button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-venue="${escapeHTML(venue.Venue_ID)}">Open Venue</button>` : ''}</div><div class="calendar-event-body"><div class="calendar-event-top"><div><h3 class="calendar-event-name display-font">${escapeHTML(event.Event_Name || 'Event')}</h3><p class="calendar-event-meta">${escapeHTML(venueName)}${location ? ` · ${escapeHTML(location)}` : ''}</p>${dateText ? `<p class="calendar-event-date">${escapeHTML(dateText)}</p>` : ''}${times ? `<p class="calendar-event-time">${escapeHTML(times)}</p>` : ''}${event.Is_Recurring ? `<p class="calendar-event-recurrence">${escapeHTML(event.Recurrence_Label)}</p>` : ''}</div>${event.Dresscode_Info ? `<div class="calendar-event-dresscode">${escapeHTML(event.Dresscode_Info)}</div>` : ''}</div>${event.Event_Description ? `<p class="calendar-event-description">${escapeHTML(event.Event_Description)}</p>` : ''}${renderEventTags(event)}</div></div></article>`;
    }

    function renderPanel() {
        const isWindowFilter = state.dateFilter !== 'all';
        const items = eventsForActiveDateFilter();
        const label = activePanelLabel();
        if (!items.length) return `<section class="calendar-event-panel"><h2 class="display-font">${label}</h2><div class="calendar-empty">No listed events match these filters yet.</div></section>`;
        return `<section class="calendar-event-panel"><h2 class="display-font">${label}</h2><p class="calendar-day-count">${items.length} event${items.length === 1 ? '' : 's'} listed</p>${items.map(event => renderEventCard(event, isWindowFilter)).join('')}</section>`;
    }

    function render() {
        const container = ensureContainer();
        ensureSelectedDate();
        container.innerHTML = `<div class="calendar-page"><div class="calendar-title-row"><div class="calendar-title-block"><h1 class="display-font">📅 EVENTS</h1>${renderCityPicker()}<p>Choose a date to see what is on.</p></div>${renderFilterStrip()}</div><div class="calendar-layout"><section class="calendar-selector"><div class="calendar-month-row"><button type="button" class="calendar-month-button" id="calendar-prev-month" aria-label="Previous month">‹</button><h2 class="display-font">${monthLabel()}</h2><button type="button" class="calendar-month-button" id="calendar-next-month" aria-label="Next month">›</button></div>${renderGrid()}<p class="calendar-key"><span class="calendar-dot"></span> Events listed on this date</p></section>${renderPanel()}</div></div>`;
        bindControls();
    }

    function activateFilter(value) {
        if (value === 'all') {
            state.dateFilter = 'all';
            state.vibeFilter = '';
        } else if (value === 'today' || value === 'week') {
            state.dateFilter = state.dateFilter === value ? 'all' : value;
        } else {
            state.vibeFilter = state.vibeFilter === value ? '' : value;
        }
        ensureSelectedDate();
        render();
    }

    function bindControls() {
        document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
            ensureSelectedDate();
            render();
        });
        document.getElementById('calendar-next-month')?.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
            ensureSelectedDate();
            render();
        });
        document.getElementById('calendar-city-select')?.addEventListener('change', event => {
            setSharedLocationFromCity(event.target.value);
            ensureSelectedDate();
            render();
        });
        document.querySelectorAll('[data-calendar-filter]').forEach(button => button.addEventListener('click', () => activateFilter(button.dataset.calendarFilter)));
        document.querySelectorAll('[data-calendar-date]').forEach(button => button.addEventListener('click', () => {
            state.dateFilter = 'all';
            state.selectedDate = button.dataset.calendarDate;
            render();
        }));
        document.querySelectorAll('[data-calendar-save]').forEach(button => button.addEventListener('click', () => {
            window.toggleEventFavorite?.(button.dataset.calendarSave, button, false);
            render();
        }));
        document.querySelectorAll('[data-calendar-venue]').forEach(button => button.addEventListener('click', () => {
            close(false);
            window.location.hash = `#venue=${button.dataset.calendarVenue}`;
        }));
    }

    async function loadData() {
        if (state.loading) return;
        state.loading = true;
        try {
            const [eventResponse, venueResponse] = await Promise.all([
                fetch('events.json', { cache: 'no-store' }),
                fetch('listings.json', { cache: 'no-store' })
            ]);
            if (!eventResponse.ok || !venueResponse.ok) throw new Error('Event data unavailable');
            state.events = await eventResponse.json();
            state.venues = await venueResponse.json();
            syncCityFromSharedLocation();
            state.loaded = true;
        } catch (error) {
            ensureContainer().innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 EVENTS</h1><p class="calendar-empty">Events could not be loaded.</p></div>';
        } finally {
            state.loading = false;
        }
    }

    function hideStandardPanels() {
        document.getElementById('context-header')?.classList.add('hidden');
        document.getElementById('main-filters')?.classList.add('hidden');
        ['discounts-container', 'about-container', 'featured-container', 'cruising-guide-container', 'welcome-screen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        const results = document.getElementById('results-container');
        if (results) results.style.display = 'none';
    }

    function close(clear = true) {
        const container = document.getElementById('calendar-container');
        container?.classList.add('hidden');
        if (container && clear) container.innerHTML = '';
        const results = document.getElementById('results-container');
        if (results) results.style.display = '';
    }

    window.closeCalendarScreen = close;
    window.openCalendarScreen = async function () {
        if (window.location.hash !== '#calendar') history.pushState(null, '', '#calendar');
        hideStandardPanels();
        const container = ensureContainer();
        container.classList.remove('hidden');
        container.innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 EVENTS</h1><p class="calendar-loading">Loading events…</p></div>';
        if (!state.loaded) await loadData();
        if (state.loaded) {
            syncCityFromSharedLocation();
            render();
        }
    };

    window.addEventListener('backroom:location-changed', () => {
        if (!state.loaded) return;
        syncCityFromSharedLocation();
        if (window.location.hash === '#calendar') render();
    });

    window.addEventListener('hashchange', () => {
        if (window.location.hash !== '#calendar') close(false);
    });
}());
