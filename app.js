// Data stores
let systemInfo = {};
let designTheme = {};
let venues = [];
let events = [];

// DOM Elements
const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const modal = document.getElementById('venue-modal');
const btnCloseModal = document.getElementById('close-modal');

// Initialize App
async function initApp() {
    try {
        // Fetch all static JSON files concurrently [cite: 84, 85, 141]
        const [sysRes, themeRes, venuesRes, eventsRes] = await Promise.all([
            fetch('system_info.json'),
            fetch('design_theme.json'),
            fetch('listings.json'),
            fetch('events.json')
        ]);

        systemInfo = await sysRes.json();
        designTheme = await themeRes.json();
        venues = await venuesRes.json();
        events = await eventsRes.json();

        applyTheme();
        populateSystemText();
        setupEventListeners();
        renderListings(venues);
        
    } catch (error) {
        console.error("Failed to load local JSON files. Note: If testing locally, you must use a local server (e.g., Live Server) to avoid CORS errors with file:// protocol.", error);
        document.getElementById('ag-text').innerText = "Error loading prototype data. Please run via a local web server.";
    }
}

// Apply Design Theme [cite: 103]
function applyTheme() {
    const root = document.documentElement;
    const p = designTheme.palette;
    root.style.setProperty('--bg-color', p.black);
    root.style.setProperty('--primary-blue', p.bright_cyan_blue);
    root.style.setProperty('--dark-blue', p.dark_cyan_blue);
    root.style.setProperty('--near-black', p.near_black_grey);
    root.style.setProperty('--navy-grey', p.deep_navy_grey);
    root.style.setProperty('--panel-dark', p.dark_panel_grey);
    root.style.setProperty('--panel-standard', p.standard_panel_grey);
    root.style.setProperty('--panel-mid', p.mid_panel_grey);
    root.style.setProperty('--soft-grey', p.soft_grey);
    root.style.setProperty('--label-grey', p.muted_label_grey);
    root.style.setProperty('--text-light', p.light_text_grey);
    root.style.setProperty('--red-orange', p.bright_red_orange);
    root.style.setProperty('--dark-red', p.dark_red);
}

// Populate Text [cite: 102]
function populateSystemText() {
    document.getElementById('ag-title').innerText = systemInfo.age_gate_title;
    document.getElementById('ag-text').innerText = systemInfo.age_gate_text;
    document.getElementById('ag-disclaimer').innerText = systemInfo.disclaimer_text;
    document.getElementById('brand-title').innerText = systemInfo.brand_name;
    document.getElementById('site-footer').innerHTML = systemInfo.footer_text;
}

// Event Listeners
function setupEventListeners() {
    btnEnter.addEventListener('click', () => {
        ageGate.classList.add('hidden');
        appShell.classList.remove('hidden');
    });

    btnCloseModal.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Close modal if clicking outside content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

// Render Listings [cite: 316-330]
function renderListings(data) {
    resultsContainer.innerHTML = '';
    data.forEach(venue => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <h3 class="card-title display-font">${venue.Name}</h3>
                    <div class="card-meta">${venue.Category} • ${venue.City}</div>
                </div>
                <div class="status-badge ${venue.Status.toLowerCase()}">${venue.Status.toUpperCase()}</div>
            </div>
            <div class="card-meta">Open: ${venue.Opening_Days}</div>
            <div class="card-stats">
                <span>🌈 ${systemInfo.labels.rated_by_gays}</span>
                <span>👁️ ${venue.Views || 0}</span>
                <span class="star-btn" data-id="${venue.Venue_ID}">☆</span>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if(!e.target.classList.contains('star-btn')) {
                openModal(venue);
            }
        });
        
        // Simple prototype favorite toggle
        const starBtn = card.querySelector('.star-btn');
        starBtn.addEventListener('click', (e) => {
            e.target.innerText = e.target.innerText === '☆' ? '★' : '☆';
            e.target.style.color = e.target.innerText === '★' ? 'var(--primary-blue)' : 'var(--text-light)';
        });

        resultsContainer.appendChild(card);
    });
}

// Open Detail Modal [cite: 332-351, 282, 298]
function openModal(venue) {
    document.getElementById('modal-title').innerText = venue.Name;
    document.getElementById('modal-address').innerText = `${venue.Address} (Nearest: ${venue.Nearest_Station || 'N/A'})`;
    document.getElementById('modal-description').innerText = venue.Description;
    
    // Ratings mapped to emojis
    const ratingsHtml = `
        <div class="rating-item"><span>General</span> <span>${'🍆'.repeat(venue.Rating_General || 0)}</span></div>
        <div class="rating-item"><span>Darkroom</span> <span>${'💦'.repeat(venue.Rating_Darkroom || 0)}</span></div>
        <div class="rating-item"><span>Cost</span> <span>${'💰'.repeat(venue.Rating_Cost || 0)}</span></div>
        <div class="rating-item"><span>Location</span> <span>${'🍑'.repeat(venue.Rating_Location || 0)}</span></div>
        <div class="rating-item"><span>Busyness</span> <span>${'🎉'.repeat(venue.Rating_Busyness || 0)}</span></div>
    `;
    document.getElementById('modal-ratings').innerHTML = ratingsHtml;

    // Feature Chips
    const features = [];
    if(venue.Feature_Darkroom) features.push('Darkroom');
    if(venue.Feature_Men_Only) features.push('Men Only');
    if(venue.Feature_Dancefloor) features.push('Dancefloor');
    if(venue.Feature_Sauna) features.push('Sauna');
    
    const featuresHtml = features.map(f => `<span class="chip" style="font-size:0.7rem; padding:4px 8px;">${f}</span>`).join('');
    document.getElementById('modal-features').innerHTML = featuresHtml;

    // Filter Events for this Venue [cite: 86, 87]
    const venueEvents = events.filter(e => e.Venue_ID === venue.Venue_ID);
    const eventsBlock = document.getElementById('modal-events');
    const eventsContainer = document.getElementById('events-container');
    
    if(venueEvents.length > 0) {
        eventsContainer.innerHTML = venueEvents.map(ev => `
            <div class="event-card">
                <strong>${ev.Event_Name}</strong><br>
                <span class="meta-text">${ev.Event_Date} | ${ev.Event_Start_Time} - ${ev.Event_End_Time || 'Late'}</span>
                <p style="font-size:0.85rem; margin-top:5px;">${ev.Event_Description}</p>
            </div>
        `).join('');
        eventsBlock.classList.remove('hidden');
    } else {
        eventsBlock.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);