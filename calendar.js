// Backroom public calendar screen — initial mobile-first events browser
(function () {
    'use strict';

    if (window.__backroomCalendarLoaded) {
        if (typeof window.openCalendarScreen === 'function') window.openCalendarScreen();
        return;
    }
    window.__backroomCalendarLoaded = true;

    const calendarState = {
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        selectedDate: toDateKey(new Date()),
        city: 'All',
        events: [],
        venues: [],
        loading: false,
        loaded: false
    };

    function ensureCalendarContainer() {
        let container = document.getElementById('calendar-container');
        if (container) return container;
        container = document.createElement('div');
        container.id = 'calendar-container';
        container.className = 'hidden';
        const contentWrapper = document.querySelector('#main-content .content-wrapper');
        const filters = document.getElementById('main-filters');
        if (contentWrapper && filters) contentWrapper.insertBefore(container, filters);
        else contentWrapper?.appendChild(container);
        return container;
    }

    function toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function eventVenue(event) {
        return calendarState.venues.find(venue => venue.Venue_ID === event.Venue_ID) || null;
    }

    function eventCity(event) {
        const venue = eventVenue(event);
        return String(venue?.City || event.City || '').split(',')[0].trim();
    }

    function publicEvents() {
        return calendarState.events.filter(event => {
            const status = String(event.Status || '').trim();
            if (status === 'Hold' || status === 'Flag' || status === 'Closed') return false;
            if (!event.Event_Date) return false;
            if (calendarState.city !== 'All' && eventCity(event) !== calendarState.city) return false;
            return true;
        });
    }

    function eventsOnDate(dateKey) {
        return publicEvents().filter(event => event.Event_Date === dateKey).sort((a, b) => String(a.Event_Start_Time || '').localeCompare(String(b.Event_Start_Time || '')));
    }

    function savedEventIds() {
        try { return JSON.parse(localStorage.getItem('br_events')) || []; }
        catch (error) { return []; }
    }

    function monthLabel() {
        return calendarState.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    function selectedDayLabel() {
        return new Date(`${calendarState.selectedDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    }

    function getMonthDates() {
        const first = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth(), 1);
        const startOffset = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < startOffset; i += 1) cells.push(null);
        for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(calendarState.month.getFullYear(), calendarState.month.getMonth(), day));
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }

    function ensureSelectedDateForMonth() {
        const date = new Date(`${calendarState.selectedDate}T12:00:00`);
        if (date.getMonth() !== calendarState.month.getMonth() || date.getFullYear() !== calendarState.month.getFullYear()) {
            const prefix = `${calendarState.month.getFullYear()}-${String(calendarState.month.getMonth() + 1).padStart(2, '0')}-`;
            const relevant = publicEvents().filter(event => event.Event_Date.startsWith(prefix)).sort((a, b) => a.Event_Date.localeCompare(b.Event_Date));
            calendarState.selectedDate = relevant[0]?.Event_Date || toDateKey(new Date(calendarState.month.getFullYear(), calendarState.month.getMonth(), 1));
        }
    }

    function renderCityPicker() {
        const cities = [...new Set(calendarState.events.map(eventCity).filter(Boolean))].sort();
        const options = ['All', ...cities].map(city => `<option value="${escapeHTML(city)}" ${calendarState.city === city ? 'selected' : ''}>${escapeHTML(city === 'All' ? 'All cities' : city)}</option>`).join('');
        return `<label class="calendar-city-label">CITY<select id="calendar-city-select" class="calendar-city-select">${options}</select></label>`;
    }

    function renderDateGrid() {
        const todayKey = toDateKey(new Date());
        const weekdayHtml = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
        const cells = getMonthDates().map(date => {
            if (!date) return '<div class="calendar-day blank" aria-hidden="true"></div>';
            const key = toDateKey(date);
            const dayEvents = eventsOnDate(key);
            return `<button type="button" class="calendar-day${key === calendarState.selectedDate ? ' selected' : ''}${key === todayKey ? ' today' : ''}${dayEvents.length ? ' has-events' : ''}" data-calendar-date="${key}"><span class="calendar-number">${date.getDate()}</span><span class="calendar-indicators">${dayEvents.length ? `<span class="calendar-dot"></span>${dayEvents.length > 1 ? `<span class="calendar-count">${dayEvents.length}</span>` : ''}` : ''}</span></button>`;
        }).join('');
        return `<div class="calendar-grid">${weekdayHtml}${cells}</div>`;
    }

    function renderEventCard(event) {
        const venue = eventVenue(event);
        const venueName = venue?.Name || 'Venue not listed';
        const location = [venue?.City, venue?.Country].filter(Boolean).join(' · ');
        const times = [event.Event_Start_Time, event.Event_End_Time].filter(Boolean).join(' – ');
        const saved = savedEventIds().includes(event.Event_ID);
        const imageUrl = String(venue?.Image_URL || '').trim() || 'placeholder_venue.jpg';
        return `<article class="calendar-event-card">
            <div class="calendar-event-layout">
                <img class="calendar-venue-thumb" src="${escapeHTML(imageUrl)}" alt="${escapeHTML(venueName)}" onerror="this.onerror=null;this.src='placeholder_venue.jpg';">
                <div class="calendar-event-body">
                    <div class="calendar-event-top">
                        <div><h3 class="calendar-event-name display-font">${escapeHTML(event.Event_Name || 'Event')}</h3><p class="calendar-event-meta">${escapeHTML(venueName)}${location ? ` · ${escapeHTML(location)}` : ''}</p>${times ? `<p class="calendar-event-time">${escapeHTML(times)}</p>` : ''}</div>
                        ${event.Dresscode_Info ? `<div class="calendar-event-tag">${escapeHTML(event.Dresscode_Info)}</div>` : ''}
                    </div>
                    ${event.Event_Description ? `<p class="calendar-event-description">${escapeHTML(event.Event_Description)}</p>` : ''}
                    <div class="calendar-event-actions">
                        <button type="button" class="btn primary-btn pill-btn calendar-action ${saved ? 'calendar-saved' : ''}" data-calendar-save="${escapeHTML(event.Event_ID)}">${saved ? '💖 Saved' : '💖 Save to My Events'}</button>
                        ${venue ? `<button type="button" class="btn secondary-btn pill-btn calendar-action" data-calendar-venue="${escapeHTML(venue.Venue_ID)}">Open Venue</button>` : ''}
                    </div>
                </div>
            </div>
        </article>`;
    }

    function renderEventPanel() {
        const selectedEvents = eventsOnDate(calendarState.selectedDate);
        if (!selectedEvents.length) return `<section class="calendar-event-panel"><h2 class="display-font">${selectedDayLabel()}</h2><div class="calendar-empty">No listed events on this date yet.</div></section>`;
        return `<section class="calendar-event-panel"><h2 class="display-font">${selectedDayLabel()}</h2><p class="calendar-day-count">${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'} listed</p>${selectedEvents.map(renderEventCard).join('')}</section>`;
    }

    function renderCalendar() {
        const container = ensureCalendarContainer();
        ensureSelectedDateForMonth();
        container.innerHTML = `<div class="calendar-page">
            <div class="calendar-title-row"><div><h1 class="display-font">📅 CALENDAR</h1><p>Choose a date to see what is on.</p></div>${renderCityPicker()}</div>
            <div class="calendar-layout"><section class="calendar-selector"><div class="calendar-month-row"><button type="button" class="calendar-month-button" id="calendar-prev-month">‹</button><h2 class="display-font">${monthLabel()}</h2><button type="button" class="calendar-month-button" id="calendar-next-month">›</button></div>${renderDateGrid()}<p class="calendar-key"><span class="calendar-dot"></span> Events listed on this date</p></section>${renderEventPanel()}</div>
        </div>`;
        bindCalendarControls();
    }

    function bindCalendarControls() {
        document.getElementById('calendar-prev-month')?.addEventListener('click', () => { calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() - 1, 1); ensureSelectedDateForMonth(); renderCalendar(); });
        document.getElementById('calendar-next-month')?.addEventListener('click', () => { calendarState.month = new Date(calendarState.month.getFullYear(), calendarState.month.getMonth() + 1, 1); ensureSelectedDateForMonth(); renderCalendar(); });
        document.getElementById('calendar-city-select')?.addEventListener('change', event => { calendarState.city = event.target.value; ensureSelectedDateForMonth(); renderCalendar(); });
        document.querySelectorAll('[data-calendar-date]').forEach(button => button.addEventListener('click', () => { calendarState.selectedDate = button.dataset.calendarDate; renderCalendar(); }));
        document.querySelectorAll('[data-calendar-save]').forEach(button => button.addEventListener('click', () => { if (typeof window.toggleEventFavorite === 'function') { window.toggleEventFavorite(button.dataset.calendarSave, button, false); renderCalendar(); } }));
        document.querySelectorAll('[data-calendar-venue]').forEach(button => button.addEventListener('click', () => { closeCalendarScreen(false); window.location.hash = `#venue=${button.dataset.calendarVenue}`; }));
    }

    async function loadCalendarData() {
        if (calendarState.loading) return;
        calendarState.loading = true;
        try {
            const [eventResponse, venueResponse] = await Promise.all([fetch(`events.json?v=${Date.now()}`), fetch(`listings.json?v=${Date.now()}`)]);
            if (!eventResponse.ok || !venueResponse.ok) throw new Error('Calendar data unavailable');
            calendarState.events = await eventResponse.json();
            calendarState.venues = await venueResponse.json();
            calendarState.loaded = true;
        } catch (error) {
            ensureCalendarContainer().innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 CALENDAR</h1><p class="calendar-empty">Calendar data could not be loaded.</p></div>';
        } finally { calendarState.loading = false; }
    }

    function hideStandardPanels() {
        document.getElementById('context-header')?.classList.add('hidden');
        document.getElementById('main-filters')?.classList.add('hidden');
        ['discounts-container', 'about-container', 'featured-container', 'cruising-guide-container', 'welcome-screen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        const results = document.getElementById('results-container');
        if (results) results.style.display = 'none';
    }

    function closeCalendarScreen(clearDisplay = true) {
        const container = document.getElementById('calendar-container');
        container?.classList.add('hidden');
        if (container && clearDisplay) container.innerHTML = '';
        const results = document.getElementById('results-container');
        if (results) results.style.display = '';
    }

    window.closeCalendarScreen = closeCalendarScreen;
    window.openCalendarScreen = async function () {
        if (window.location.hash !== '#calendar') history.pushState(null, '', '#calendar');
        hideStandardPanels();
        const container = ensureCalendarContainer();
        container.classList.remove('hidden');
        container.innerHTML = '<div class="calendar-page"><h1 class="display-font">📅 CALENDAR</h1><p class="calendar-loading">Loading events…</p></div>';
        if (!calendarState.loaded) await loadCalendarData();
        if (calendarState.loaded) renderCalendar();
    };

    window.addEventListener('hashchange', () => { if (window.location.hash !== '#calendar') closeCalendarScreen(false); });

    const style = document.createElement('style');
    style.textContent = `#calendar-container{padding:0 20px 20px}.calendar-page{max-width:1120px;margin:0 auto;background:var(--panel-dark);border:1px solid var(--panel-mid);border-radius:var(--radius-card);padding:24px;color:#fff}.calendar-title-row{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.calendar-title-row h1{margin:0;color:var(--primary-blue);font-size:2.2rem}.calendar-title-row p{color:var(--text-light);margin:4px 0 0}.calendar-city-label{display:flex;flex-direction:column;gap:5px;color:var(--text-light);font-size:.85rem;font-weight:bold;min-width:180px}.calendar-city-select{background:var(--panel-mid);border:1px solid var(--primary-blue);border-radius:999px;padding:9px 14px;color:#fff;font:inherit;font-size:1rem}.calendar-layout{display:grid;grid-template-columns:minmax(300px,400px) 1fr;gap:22px;align-items:start}.calendar-selector,.calendar-event-panel{background:var(--near-black);border:1px solid var(--panel-mid);border-radius:var(--radius-card);padding:18px}.calendar-month-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.calendar-month-row h2{margin:0;color:var(--primary-blue);font-size:1.55rem}.calendar-month-button{height:40px;width:40px;border-radius:50%;border:1px solid var(--primary-blue);background:transparent;color:#fff;font-size:2rem;line-height:1;cursor:pointer}.calendar-month-button:hover{background:var(--primary-blue)}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.calendar-weekday{text-align:center;color:var(--text-light);font-weight:bold;padding:7px 0;font-size:.9rem}.calendar-day{min-height:48px;position:relative;background:var(--panel-dark);color:#fff;border:1px solid transparent;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}.calendar-day.blank{background:transparent;cursor:default}.calendar-day:hover:not(.blank){border-color:var(--primary-blue)}.calendar-day.today{border-color:var(--bright-red-orange)}.calendar-day.selected{background:var(--primary-blue);border-color:var(--primary-blue);font-weight:bold}.calendar-indicators{height:8px;display:flex;align-items:center;gap:3px}.calendar-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--bright-red-orange)}.calendar-count{font-size:.65rem;color:var(--bright-red-orange);font-weight:bold}.calendar-day.selected .calendar-dot{background:#fff}.calendar-day.selected .calendar-count{color:#fff}.calendar-key{display:flex;align-items:center;gap:7px;color:var(--text-light);font-size:.9rem;margin:14px 0 0}.calendar-event-panel h2{color:var(--primary-blue);font-size:1.55rem;margin:0 0 4px}.calendar-day-count{margin:0 0 14px;color:var(--text-light)}.calendar-event-card{background:var(--panel-dark);border:1px solid var(--panel-mid);border-radius:var(--radius-card);padding:15px;margin-bottom:12px}.calendar-event-layout{display:flex;gap:13px;align-items:flex-start}.calendar-venue-thumb{width:64px;height:64px;flex:0 0 64px;border-radius:8px;object-fit:cover;border:1px solid var(--panel-mid);background:var(--near-black)}.calendar-event-body{flex:1;min-width:0}.calendar-event-top{display:flex;justify-content:space-between;gap:12px;align-items:start}.calendar-event-name{color:#fff;font-size:1.35rem;margin:0 0 4px}.calendar-event-meta,.calendar-event-time{margin:0 0 3px;color:var(--text-light)}.calendar-event-time{color:#fff;font-weight:bold}.calendar-event-tag{font-size:.85rem;color:#fff;background:var(--dark-red);border-radius:999px;padding:5px 10px;white-space:nowrap}.calendar-event-description{color:#fff;margin:10px 0 8px;line-height:1.4}.calendar-event-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.calendar-action{width:auto;padding:4px 10px;font-size:.88rem;min-height:30px;line-height:1.15}.calendar-saved{background:var(--dark-red)}.calendar-empty,.calendar-loading{padding:30px 10px;text-align:center;color:var(--text-light)}@media(max-width:768px){#calendar-container{padding:0 10px 14px}.calendar-page{padding:15px}.calendar-title-row{flex-direction:column;align-items:stretch;margin-bottom:14px}.calendar-title-row h1{font-size:1.8rem}.calendar-city-label{min-width:0}.calendar-layout{grid-template-columns:1fr;gap:14px}.calendar-selector,.calendar-event-panel{padding:12px}.calendar-month-row h2{font-size:1.3rem}.calendar-day{min-height:43px}.calendar-event-layout{gap:10px}.calendar-venue-thumb{width:54px;height:54px;flex-basis:54px}.calendar-event-top{flex-direction:column;gap:7px}.calendar-action{font-size:.84rem;padding:4px 9px}}`;
    document.head.appendChild(style);
    if (window.location.hash === '#calendar') window.openCalendarScreen();
}());
