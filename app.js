let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilter = 'All';

const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const modal = document.getElementById('venue-modal');
const btnCloseModal = document.getElementById('close-modal');
const locModal = document.getElementById('location-modal');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.chip');

// Mobile Sidebar Elements
const sidebar = document.getElementById('sidebar');
const hitArea = document.getElementById('sidebar-hit-area');
let sidebarTimeout;

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

        applyTheme(); populateSystemText(); setupEventListeners(); loadSavedLocation(); 
        applyFilters(); // Initial render
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
    
    // Location Modal
    document.getElementById('btn-location').addEventListener('click', () => locModal.classList.remove('hidden'));
    document.getElementById('close-location-modal').addEventListener('click', () => locModal.classList.add('hidden'));
    document.getElementById('btn-save-location').addEventListener('click', saveLocation);
    document.getElementById('btn-clear-location').addEventListener('click', clearLocation);
    document.getElementById('btn-gps').addEventListener('click', () => {
        alert("GPS Location requested (Prototype placeholder)");
        document.getElementById('loc-city').value = "GPS Location";
        saveLocation();
    });

    // Mobile Sidebar Interaction
    if(hitArea && sidebar) {
        const showSidebar = () => {
            sidebar.classList.add('visible');
            clearTimeout(sidebarTimeout);
            sidebarTimeout = setTimeout(() => { sidebar.classList.remove('visible'); }, 5000);
        };
        hitArea.addEventListener('click', showSidebar);
        sidebar.addEventListener('click', showSidebar);
    }

    // Search Input
    searchInput.addEventListener('input', applyFilters);

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.getAttribute('data-filter');
            applyFilters();
        });
    });
}

function applyFilters() {
    const query = searchInput.value;
    let filteredVenues = venues;

    // Apply categorical chip filter first
    if(activeFilter !== 'All') {
        filteredVenues = filteredVenues.filter(v => {
            if(activeFilter === 'Darkroom') return v.Feature_Darkroom;
            if(activeFilter === 'Men Only') return v.Feature_Men_Only;
            if(activeFilter === 'Open Now') return v.Status === 'Live'; // Basic prototype proxy for "Open Now"
            return true;
        });
    }

    // Apply fuzzy text search
    if(query.trim() !== '') {
        filteredVenues = filteredVenues.filter(v => fuzzyMatch(v.Name + " " + v.Description, query));
    }

    renderListings(filteredVenues);
}

// Levenshtein distance
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

function fuzzyMatch(text, query) {
    if(!query) return true;
    const str = text.toLowerCase();
    const q = query.toLowerCase();
    if (str.includes(q)) return true;
    
    const words = str.split(/[\s,.-]+/);
    const queryWords = q.split(/[\s,.-]+/);
    
    for(let qw of queryWords) {
        if(!qw) continue;
        let matchFound = false;
        for(let w of words) {
            if(!w) continue;
            if(Math.abs(w.length - qw.length) <= 1) {
                if(getLevenshteinDistance(w, qw) <= 1) {
                    matchFound = true; break;
                }
            }
        }
        if(!matchFound) return false; 
    }
    return true;
}

function saveLocation() {
    const loc = { country: document.getElementById('loc-country').value, city: document.getElementById('loc-city').value, postcode: document.getElementById('loc-postcode').value };
    localStorage.setItem('br_location', JSON.stringify(loc));
    updateLocationDisplay(loc);
    locModal.classList.add('hidden');
}

function clearLocation() {
    localStorage.removeItem('br_location');
    document.getElementById('loc-country').value = ''; document.getElementById('loc-city').value = ''; document.getElementById('loc-postcode').value = '';
    updateLocationDisplay(null);
}

function loadSavedLocation() {
    const saved = localStorage.getItem('br_location');
    if(saved) {
        const loc = JSON.parse(saved);
        document.getElementById('loc-country').value = loc.country || ''; document.getElementById('loc-city').value = loc.city || ''; document.getElementById('loc-postcode').value = loc.postcode || '';
        updateLocationDisplay(loc);
    }
}

function updateLocationDisplay(loc) {
    const display = document.getElementById('current-location-display');
    if(loc && (loc.city || loc.country)) { display.innerText = `Current: ${loc.city ? loc.city : ''} ${loc.country ? loc.country : ''}`; } 
    else { display.innerText = 'No location set.'; }
}

function renderListings(data) {
    resultsContainer.innerHTML = '';
    const today = new Date();
    today.setHours(0,0,0,0);

    if(data.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No venues found matching your criteria.</p>';
        return;
    }

    data.forEach(venue => {
        let nextEventHtml = '';
        let venueEvents = events.filter(e => e.Venue_ID === venue.Venue_ID && new Date(e.Event_Date) >= today);
        if(venueEvents.length > 0) {
            venueEvents.sort((a, b) => new Date(a.Event_Date) - new Date(b.Event_Date));
            const nextE = venueEvents[0];
            nextEventHtml = `<div class="card-next-event">📅 Next: ${nextE.Event_Name} (${nextE.Event_Date})</div>`;
        }

        const shortDesc = venue.Description.length > 90 ? venue.Description.substring(0, 90) + '...' : venue.Description;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-image-wrapper"><div class="image-placeholder" style="width:100%; border-radius:0;">VENUE IMAGE</div></div>
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${venue.Name}</h3><div class="card-meta">${venue.Category} • ${venue.City}</div></div>
                    <div class="status-badge ${venue.Status.toLowerCase()}">${venue.Status.toUpperCase()}</div>
                </div>
                <div class="card-about">${shortDesc}</div>
                ${nextEventHtml}
                <div class="card-stats"><span>🌈 ${systemInfo.labels.rated_by_gays}</span><span>👁️ ${venue.Views || 0}</span><span class="star-btn" data-id="${venue.Venue_ID}">☆</span></div>
            </div>
        `;
        card.addEventListener('click', (e) => { if(!e.target.classList.contains('star-btn')) openModal(venue); });
        resultsContainer.appendChild(card);
    });
}

function openModal(venue) {
    document.getElementById('modal-title').innerText = venue.Name;
    document.getElementById('modal-address').innerText = `${venue.Address}`;
    document.getElementById('modal-description').innerText = venue.Description;
    document.getElementById('modal-public-stats').innerHTML = `<span>🌈 ${systemInfo.labels.rated_by_gays}</span> <span>👁️ ${venue.Views || 0}</span>`;
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
    document.getElementById('modal-features').innerHTML = features.map(f => `<span class="chip" style="font-size:0.85rem;">${f}</span>`).join('');

    let venueEvents = events.filter(e => e.Venue_ID === venue.Venue_ID);
    const eventsBlock = document.getElementById('modal-events');
    const eventsContainer = document.getElementById('events-container');
    
    if(venueEvents.length > 0) {
        const today = new Date();
        today.setHours(0,0,0,0);
        venueEvents.sort((a, b) => {
            const dateA = new Date(a.Event_Date); const dateB = new Date(b.Event_Date);
            const isPastA = dateA < today; const isPastB = dateB < today;
            if (isPastA && !isPastB) return 1; if (!isPastA && isPastB) return -1;
            return Math.abs(dateA - today) - Math.abs(dateB - today);
        });
        eventsContainer.innerHTML = venueEvents.map(ev => {
            const isPast = new Date(ev.Event_Date) < today;
            return `<div class="event-card ${isPast ? 'past' : ''}"><strong>${ev.Event_Name}</strong> ${isPast ? '<small>(Past)</small>' : ''}<br><span class="meta-text">${ev.Event_Date} | ${ev.Event_Start_Time}</span><p style="font-size:0.9rem; margin-top:5px;">${ev.Event_Description}</p></div>`;
        }).join('');
        eventsBlock.classList.remove('hidden');
    } else {
        eventsBlock.classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', initApp);