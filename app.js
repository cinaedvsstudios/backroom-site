// --- Application State ---
const APP_VERSION = "v0.31";
const APP_DATE = "May 14, 2026";

let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilter = 'All';
let currentEventCityFilter = 'All';

// Profile Data Structure (Save Game Style)
let userProfile = JSON.parse(localStorage.getItem('br_profile')) || { name: '', avatar: '' };
let savedProfiles = JSON.parse(localStorage.getItem('br_saved_profiles')) || {};

// Globals that will be swapped per profile
let userFavorites = [];
let userShortlists = {};
let userEvents = [];
let userTravel = [];

const avatarCategories = ["Twink", "Twunk", "Jock", "Muscle", "Geek", "Uncle", "Daddy", "Silver Fox", "Opa", "Bear", "Seal", "Otter", "Cub", "Wolf", "Circuit", "Leather", "Rubber", "Puppy", "Alternative", "Queer", "Femboy", "Slave"];

// --- Logic to switch profile data bundles ---
function loadActiveProfileData() {
    if (userProfile.name && savedProfiles[userProfile.name]) {
        const bundle = savedProfiles[userProfile.name];
        userFavorites = bundle.favorites || [];
        userShortlists = bundle.shortlists || {};
        userEvents = bundle.events || [];
        userTravel = bundle.travel || [];
    } else {
        userFavorites = JSON.parse(localStorage.getItem('br_favorites')) || [];
        userShortlists = JSON.parse(localStorage.getItem('br_shortlists')) || {};
        userEvents = JSON.parse(localStorage.getItem('br_events')) || [];
        userTravel = JSON.parse(localStorage.getItem('br_travel')) || [];
    }
}

function saveCurrentToBundle() {
    if (userProfile.name) {
        savedProfiles[userProfile.name] = {
            ...userProfile,
            favorites: userFavorites,
            shortlists: userShortlists,
            events: userEvents,
            travel: userTravel
        };
        localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
    }
    // Backward compatibility keys
    localStorage.setItem('br_favorites', JSON.stringify(userFavorites));
    localStorage.setItem('br_shortlists', JSON.stringify(userShortlists));
    localStorage.setItem('br_events', JSON.stringify(userEvents));
    localStorage.setItem('br_travel', JSON.stringify(userTravel));
    localStorage.setItem('br_profile', JSON.stringify(userProfile));
}

// --- Ratings Image Helper ---
function getRatingHtml(val, type) {
    const map = {
        'General': 'eggplant',
        'Darkroom': 'water',
        'Cost': 'money',
        'Location': 'peach',
        'Popularity': 'busy'
    };
    const folderPrefix = map[type] || 'eggplant';
    let html = '';
    for(let i=1; i<=5; i++) {
        const op = i <= val ? '1' : '0.25'; // 75% transparency for empty slots
        html += `<img src="Emoji/${folderPrefix}0${i}.png" class="rating-png" style="opacity:${op}">`;
    }
    return html;
}

// --- UI Rendering logic ---

function openVenueModal(venue) {
    const dynamicLayout = document.getElementById('modal-dynamic-layout');
    if(!dynamicLayout) return;

    const features = [];
    if(venue.Feature_Darkroom) features.push('Darkroom');
    if(venue.Feature_Men_Only) features.push('Men Only');
    if(venue.Feature_Dancefloor) features.push('Dancefloor');
    const featureHtml = features.map(f => `<span class="chip pill-btn" style="font-size:0.85rem; padding: 4px 10px;">${f}</span>`).join('');

    const statsHtml = `<div class="public-stats-block"><span>🌈 Rated</span> <span>👁️ ${venue.Views || 0}</span></div><div class="feature-chips" style="margin-top: 15px;">${featureHtml}</div>`;
    
    const ratingsHtml = `
        <div class="ratings-grid">
            <div class="rating-item"><span>General</span><span>${getRatingHtml(venue.Rating_General, 'General')}</span></div>
            <div class="rating-item"><span>Darkroom</span><span>${getRatingHtml(venue.Rating_Darkroom, 'Darkroom')}</span></div>
            <div class="rating-item"><span>Cost</span><span>${getRatingHtml(venue.Rating_Cost, 'Cost')}</span></div>
            <div class="rating-item"><span>Location</span><span>${getRatingHtml(venue.Rating_Location, 'Location')}</span></div>
            <div class="rating-item"><span>Popularity</span><span>${getRatingHtml(venue.Rating_Busyness, 'Popularity')}</span></div>
        </div>`;

    // New FULL WIDTH Restructure for v0.31
    dynamicLayout.innerHTML = `
        <div class="modal-top-split">
            <div class="modal-left-col">
                <div class="modal-image-container">
                    <img id="modal-venue-image" class="venue-image centered-image" src="Venue_images/${venue.Venue_ID}-01.jpg" onerror="this.src='placeholder_venue.jpg'">
                </div>
                <div class="desktop-stats"><div class="desktop-stats-container">${statsHtml}</div></div>
            </div>
            <div class="modal-right-col">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <button id="btn-map" class="btn secondary-btn pill-btn" style="padding: 2px 8px; font-size: 0.75rem; width: auto;">🗺️ Directions</button>
                    <p class="meta-text" style="margin:0;">${venue.Address || ''}</p>
                </div>
                <div class="mobile-stats">${statsHtml}</div>
                ${ratingsHtml}
            </div>
        </div>
        
        <hr style="border: 0; height: 2px; background: var(--bright-red-orange); margin: 20px 0;">
        
        <div class="full-width-about">
            <h3 class="display-font" style="color: var(--primary-blue); margin-bottom:10px;">ABOUT</h3>
            <p style="color: #fff; line-height: 1.5;">${venue.Description || ''}</p>
        </div>
        
        <div id="modal-events-container"></div>
    `;

    // Modal logic for Directions, Events, etc stays same as v0.30 but with updated map URL:
    document.getElementById('btn-map').onclick = () => {
        const query = encodeURIComponent(venue.Address || venue.City || venue.Name);
        window.open(`https://www.google.com/maps/search/?api=1&query=?q=${query}`, '_blank');
    };

    document.getElementById('venue-modal').classList.remove('hidden');
}

// [Include all other app.js setup logic from v0.30 but call loadActiveProfileData() in initApp()]