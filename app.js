let systemInfo = {}, designTheme = {}, venues = [], events = [];

const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const modal = document.getElementById('venue-modal');
const btnCloseModal = document.getElementById('close-modal');

async function initApp() {
    try {
        const [sysRes, themeRes, venuesRes, eventsRes] = await Promise.all([
            fetch('system_info.json'), fetch('design_theme.json'),
            fetch('listings.json'), fetch('events.json')
        ]);
        systemInfo = await sysRes.json();
        designTheme = await themeRes.json();
        venues = await venuesRes.json();
        events = await eventsRes.json();

        applyTheme(); populateSystemText(); setupEventListeners(); renderListings(venues);
    } catch (error) {
        console.error("Local JSON fetch failed. Run via local web server.", error);
        document.getElementById('ag-text').innerText = "Data error. Run via local server.";
    }
}

function applyTheme() {
    const r = document.documentElement, p = designTheme.palette;
    r.style.setProperty('--bg-color', p.black); r.style.setProperty('--primary-blue', p.bright_cyan_blue);
    r.style.setProperty('--near-black', p.near_black_grey); r.style.setProperty('--navy-grey', p.deep_navy_grey);
    r.style.setProperty('--panel-dark', p.dark_panel_grey); r.style.setProperty('--panel-standard', p.standard_panel_grey);
    r.style.setProperty('--panel-mid', p.mid_panel_grey); r.style.setProperty('--label-grey', p.muted_label_grey);
    r.style.setProperty('--text-light', p.light_text_grey); r.style.setProperty('--red-orange', p.bright_red_orange);
}

function populateSystemText() {
    document.getElementById('ag-text').innerText = systemInfo.age_gate_text;
    document.getElementById('ag-disclaimer').innerText = systemInfo.disclaimer_text;
    if(systemInfo.short_brand_name) document.getElementById('brand-title').innerText = systemInfo.short_brand_name;
}

function setupEventListeners() {
    btnEnter.addEventListener('click', () => { ageGate.classList.add('hidden'); appShell.classList.remove('hidden'); });
    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

function renderListings(data) {
    resultsContainer.innerHTML = '';
    data.forEach(venue => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div><h3 class="card-title display-font">${venue.Name}</h3><div class="card-meta">${venue.Category} • ${venue.City}</div></div>
                <div class="status-badge ${venue.Status.toLowerCase()}">${venue.Status.toUpperCase()}</div>
            </div>
            <div class="card-stats"><span>🌈 ${systemInfo.labels.rated_by_gays}</span><span>👁️ ${venue.Views || 0}</span><span class="star-btn" data-id="${venue.Venue_ID}">☆</span></div>
        `;
        card.addEventListener('click', (e) => { if(!e.target.classList.contains('star-btn')) openModal(venue); });
        resultsContainer.appendChild(card);
    });
}

function openModal(venue) {
    document.getElementById('modal-title').innerText = venue.Name;
    document.getElementById('modal-address').innerText = `${venue.Address}`;
    document.getElementById('modal-description').innerText = venue.Description;
    
    document.getElementById('modal-public-stats').innerHTML = `
        <span>🌈 ${systemInfo.labels.rated_by_gays}</span> 
        <span>👁️ ${venue.Views || 0}</span>
    `;

    document.getElementById('modal-ratings').innerHTML = `
        <div class="rating-item"><span>General</span><span>${'🍆'.repeat(venue.Rating_General || 0)}</span></div>
        <div class="rating-item"><span>Darkroom</span><span>${'💦'.repeat(venue.Rating_Darkroom || 0)}</span></div>
        <div class="rating-item"><span>Cost</span><span>${'💰'.repeat(venue.Rating_Cost || 0)}</span></div>
        <div class="rating-item"><span>Location</span><span>${'🍑'.repeat(venue.Rating_Location || 0)}</span></div>
        <div class="rating-item"><span>Busyness</span><span>${'🎉'.repeat(venue.Rating_Busyness || 0)}</span></div>
    `;

    const features = [];
    if(venue.Feature_Darkroom) features.push('Darkroom');
    if(venue.Feature_Men_Only) features.push('Men Only');
    if(venue.Feature_Dancefloor) features.push('Dancefloor');
    if(venue.Feature_Sauna) features.push('Sauna');
    document.getElementById('modal-features').innerHTML = features.map(f => `<span class="chip" style="font-size:0.75rem;">${f}</span>`).join('');

    // Event sorting logic
    let venueEvents = events.filter(e => e.Venue_ID === venue.Venue_ID);
    const eventsBlock = document.getElementById('modal-events');
    const eventsContainer = document.getElementById('events-container');
    
    if(venueEvents.length > 0) {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        venueEvents.sort((a, b) => {
            const dateA = new Date(a.Event_Date); const dateB = new Date(b.Event_Date);
            const isPastA = dateA < today; const isPastB = dateB < today;
            if (isPastA && !isPastB) return 1;
            if (!isPastA && isPastB) return -1;
            return Math.abs(dateA - today) - Math.abs(dateB - today);
        });

        eventsContainer.innerHTML = venueEvents.map(ev => {
            const isPast = new Date(ev.Event_Date) < today;
            return `<div class="event-card ${isPast ? 'past' : ''}">
                <strong>${ev.Event_Name}</strong> ${isPast ? '<small>(Past)</small>' : ''}<br>
                <span class="meta-text">${ev.Event_Date} | ${ev.Event_Start_Time}</span>
                <p style="font-size:0.85rem; margin-top:5px;">${ev.Event_Description}</p>
            </div>`;
        }).join('');
        eventsBlock.classList.remove('hidden');
    } else {
        eventsBlock.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', initApp);