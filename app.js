// --- Application State ---
const APP_VERSION = "v0.41";
const APP_DATE = "May 20, 2026";

let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilter = 'All';
let selectedCardId = null;
let currentTargetVenue = null; 
let currentEventCityFilter = 'All';

// Profile Data Structure (Save Game Style)
let userProfile = JSON.parse(localStorage.getItem('br_profile')) || { name: '', avatar: 'noavatar01.png' };
let savedProfiles = JSON.parse(localStorage.getItem('br_saved_profiles')) || {};

// Globals swapped per profile
let userFavorites = [];
let userShortlists = {};
let userEvents = [];
let userTravel = [];

let importInfo = JSON.parse(localStorage.getItem('br_import_info')) || null;
let avatarData = [];
let activeAvatarCategory = 'All';

let leafletMap = null;
let leafletMarker = null;

// Tutorial State
let currentTutorialStep = 0;
let tutorialSteps = [];

const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const errorPanel = document.getElementById('error-panel');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.chip');
const contextHeader = document.getElementById('context-header');
const welcomeScreen = document.getElementById('welcome-screen');
const venueModal = document.getElementById('venue-modal');
const locModal = document.getElementById('location-modal');
const settingsModal = document.getElementById('settings-modal');
const addShortlistModal = document.getElementById('add-to-shortlist-modal');
const profileModal = document.getElementById('profile-modal');
const sidebar = document.getElementById('sidebar');
const hitArea = document.getElementById('sidebar-hit-area');
let sidebarTimeout;

function showToast(message) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    container.classList.remove('hidden');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function formatDateToDDMMYYYY(ymdDate) {
    if(!ymdDate) return '';
    const parts = ymdDate.split('-');
    if(parts.length !== 3) return ymdDate;
    return `${parts[2]}-${parts[1]}-${parts[0]}`; 
}

function getBadgeDateParts(ymdDate) {
    if(!ymdDate) return { d:'', my:'' };
    const parts = ymdDate.split('-');
    if(parts.length !== 3) return { d:'', my:'' };
    return { d: parts[2], my: `${parts[1]}-${parts[0]}` };
}

function recordUserInteraction() {
    sessionStorage.setItem('br_welcome_dismissed', 'true');
    welcomeScreen?.classList.add('hidden');
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    var R = 6371; var dLat = (lat2-lat1) * (Math.PI/180); var dLon = (lon2-lon1) * (Math.PI/180); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

// --- Backroom Syntax Parser ---
function formatAboutText(text) {
    if (!text) return '';
    let lines = text.split('==');
    let out = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (line === '=====') {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push('<hr style="border: 0; height: 1px; background: var(--primary-blue); margin: 15px 0;">');
            continue;
        }
        if (line === '------') {
            if (inList) { out.push('</ul>'); inList = false; }
            continue;
        }
        if (line.startsWith('*****')) {
            if (inList) { out.push('</ul>'); inList = false; }
            let heading = line.replace('*****', '').trim();
            out.push(`<h4 style="color: var(--primary-blue); font-family: 'Antonio', sans-serif; text-transform: uppercase; margin-top: 15px; margin-bottom: 5px;">${heading}</h4>`);
            continue;
        }
        if (line.startsWith('-- ')) {
            if (!inList) { out.push('<ul style="margin-left: 20px; margin-bottom: 10px; color: #fff;">'); inList = true; }
            let bullet = line.substring(3).trim();
            out.push(`<li style="margin-bottom: 4px;">${bullet.replace(/!!(.*?)!!/g, '<strong>$1</strong>')}</li>`);
            continue;
        }
        
        if (inList) { out.push('</ul>'); inList = false; }
        if (line !== '') {
            line = line.replace(/!!(.*?)!!/g, '<strong>$1</strong>');
            out.push(`${line}<br>`);
        }
    }
    if (inList) out.push('</ul>');
    
    return out.join('\n');
}

// --- Social Icons Builder ---
function buildSocialBar(venue) {
    let html = '<div class="social-bar" style="display:flex; gap:12px; margin-top:10px; align-items:center;">';
    const buildIcon = (url, iconName) => {
        const hasUrl = url && url.trim() !== '';
        const opacity = hasUrl ? '1' : '0.6';
        const cursor = hasUrl ? 'pointer' : 'default';
        const clickAction = hasUrl ? `onclick="window.open('${url}', '_blank')"` : '';
        return `<img src="Emoji/${iconName}" style="width:24px; height:24px; opacity:${opacity}; cursor:${cursor}; transition: opacity 0.2s;" ${clickAction} alt="${iconName}">`;
    };
    html += buildIcon(venue.Instagram_URL, 'instagram_url.png');
    html += buildIcon(venue.Facebook_URL, 'facebook_url.png');
    html += buildIcon(venue.Website_URL, 'website_url.png');
    html += buildIcon(venue.Emoji_Override, 'xicon.png'); 
    html += buildIcon(venue.Other_URL, 'link.png');
    html += '</div>';
    return html;
}

function loadActiveProfileData() {
    if (userProfile.name && savedProfiles[userProfile.name]) {
        const bundle = savedProfiles[userProfile.name];
        userFavorites = bundle.favorites || [];
        userShortlists = bundle.shortlists || {};
        userEvents = bundle.events || [];
        userTravel = bundle.travel || [];
        userProfile.avatar = bundle.avatar || 'noavatar01.png';
    } else {
        userFavorites = JSON.parse(localStorage.getItem('br_favorites')) || [];
        userShortlists = JSON.parse(localStorage.getItem('br_shortlists')) || {};
        userEvents = JSON.parse(localStorage.getItem('br_events')) || [];
        userTravel = JSON.parse(localStorage.getItem('br_travel')) || [];
        if(!userProfile.avatar) userProfile.avatar = 'noavatar01.png';
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
    localStorage.setItem('br_favorites', JSON.stringify(userFavorites));
    localStorage.setItem('br_shortlists', JSON.stringify(userShortlists));
    localStorage.setItem('br_events', JSON.stringify(userEvents));
    localStorage.setItem('br_travel', JSON.stringify(userTravel));
    localStorage.setItem('br_profile', JSON.stringify(userProfile));
}

function setupCriticalListeners() {
    const handleEnter = (e) => {
        if(e.cancelable) e.preventDefault();
        localStorage.setItem('br_age_verified', 'true');
        ageGate?.classList.add('hidden');
        appShell?.classList.remove('hidden');
        showToast("Backroom " + APP_VERSION);
        handleRouting(); 
    };
    btnEnter?.addEventListener('click', handleEnter);
    btnEnter?.addEventListener('touchstart', handleEnter, {passive: false});

    if(localStorage.getItem('br_age_verified') === 'true') {
        ageGate?.classList.add('hidden');
        appShell?.classList.remove('hidden');
        showToast("Backroom " + APP_VERSION);
    }
}

async function initApp() {
    loadActiveProfileData(); 
    setupCriticalListeners();
    const verDisplay = document.getElementById('sidebar-version-display');
    if(verDisplay) verDisplay.innerHTML = `${APP_VERSION}<br>${APP_DATE}`;
    
    updateProfileDisplay();
    checkImportPreview();

    try {
        const fetchJson = async (url) => {
            const cacheBuster = '?v=' + new Date().getTime();
            const res = await fetch(url + cacheBuster);
            if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
            return res.json();
        };

        try { systemInfo = await fetchJson('system_info.json'); } catch(e) { console.warn("Using default system info."); }
        try { designTheme = await fetchJson('design_theme.json'); } catch(e) { console.warn("Using default theme."); }
        try { events = await fetchJson('events.json'); } catch(e) { events = []; }
        try { 
            const avatarRes = await fetch('Profile_images/avatar_list.json?v=' + new Date().getTime());
            if(avatarRes.ok) avatarData = await avatarRes.json();
        } catch(e) { console.warn("Avatar JSON missing"); avatarData = []; }

        try {
            venues = await fetchJson('listings.json');
        } catch (e) {
            throw new Error(`Failed to load listings.json. Error: ${e.message}`);
        }

        applyTheme(); 
        populateSystemText(); 
        setupEventListeners(); 
        loadSavedLocation(); 
        
        if(localStorage.getItem('br_age_verified') === 'true') handleRouting();
        
    } catch (error) {
        console.error("Data load failed:", error);
        const errText = document.getElementById('error-text');
        if(errText) errText.innerText = `SYSTEM ERROR: ${error.message}. Click bypass below to view a dummy UI.`;
        errorPanel?.classList.remove('hidden');
        
        const bypassContainer = document.getElementById('bypass-container');
        if(bypassContainer) {
            bypassContainer.innerHTML = '';
            const bypassBtn = document.createElement('button');
            bypassBtn.innerText = "Continue Without Data (Dummy Mode)";
            bypassBtn.className = "btn secondary-btn pill-btn display-font";
            
            const bypassLogic = (e) => {
                if(e && e.cancelable) e.preventDefault();
                errorPanel?.classList.add('hidden');
                if(!systemInfo.labels) systemInfo = { labels: { rated_by_gays: "Rated by gays" } };
                
                venues = [{ 
                    Venue_ID: "LOCAL-01", 
                    Name: "Dummy GitHub Venue", 
                    City: "Berlin", 
                    Category: "Club", 
                    Status: "Live", 
                    Description: "If you see this on GitHub, it means listings.json failed to load. Check the red error message that appeared previously.", 
                    Views: 420,
                    Rating_Age_Range: 3,
                    Rating_Size: 4,
                    Rating_Popularity: 5,
                    Feature_Darkroom: true
                }]; 
                if(!events) events = [];
                
                applyTheme(); populateSystemText(); setupEventListeners(); loadSavedLocation(); 
                if(localStorage.getItem('br_age_verified') === 'true') {
                    showToast("Backroom " + APP_VERSION);
                    handleRouting();
                }
            };

            bypassBtn.addEventListener('click', bypassLogic);
            bypassBtn.addEventListener('touchstart', bypassLogic, {passive: false});
            bypassContainer.appendChild(bypassBtn);
        }
    }
}

function applyTheme() {
    if(!designTheme.palette) return;
    const r = document.documentElement, p = designTheme.palette;
    r.style.setProperty('--bg-color', p.black); r.style.setProperty('--primary-blue', p.bright_cyan_blue);
    r.style.setProperty('--near-black', p.near_black_grey); r.style.setProperty('--navy-grey', p.deep_navy_grey);
    r.style.setProperty('--panel-dark', p.dark_panel_grey); r.style.setProperty('--panel-standard', p.standard_panel_grey);
    r.style.setProperty('--panel-mid', p.mid_panel_grey); r.style.setProperty('--label-grey', p.muted_label_grey);
    r.style.setProperty('--text-light', p.light_text_grey); r.style.setProperty('--bright-red-orange', p.bright_red_orange);
}

function populateSystemText() {
    const agText = document.getElementById('ag-text');
    const agDisc = document.getElementById('ag-disclaimer');
    if(agText) agText.innerText = systemInfo.age_gate_text || '';
    if(agDisc) agDisc.innerText = systemInfo.disclaimer_text || '';
}

window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    const hash = window.location.hash;
    const query = searchInput?.value.trim() || '';
    
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    contextHeader?.classList.add('hidden');
    document.getElementById('event-city-filters')?.classList.add('hidden');
    document.getElementById('btn-new-shortlist-view')?.classList.add('hidden');
    document.getElementById('main-filters')?.classList.remove('hidden');
    document.getElementById('discounts-container')?.classList.add('hidden');
    welcomeScreen?.classList.add('hidden');
    document.getElementById('profile-wipe-toast')?.classList.add('hidden');

    if (hash === '' && query === '' && activeFilter === 'All' && sessionStorage.getItem('br_welcome_dismissed') !== 'true') {
        document.getElementById('main-filters')?.classList.add('hidden');
        if(resultsContainer) resultsContainer.innerHTML = '';
        renderWelcomeScreen();
        return;
    }

    if (hash.startsWith('#venue=')) {
        const id = hash.replace('#venue=', '');
        const venue = venues.find(v => v.Venue_ID === id);
        if (venue) { openVenueModal(venue); applyFilters(); } 
        else window.location.hash = ''; 
    } else if (hash === '#favorites') {
        recordUserInteraction();
        renderFavoritesView();
    } else if (hash === '#myevents') {
        recordUserInteraction();
        renderMyEventsView();
    } else if (hash === '#myshortlists') {
        recordUserInteraction();
        renderShortlistsFullView();
    } else if (hash === '#mytravel') {
        recordUserInteraction();
        renderTravelFullView();
    } else if (hash === '#discounts') {
        recordUserInteraction();
        renderDiscountsView();
    } else if (hash.startsWith('#shortlist=')) {
        recordUserInteraction();
        const name = decodeURIComponent(hash.replace('#shortlist=', ''));
        renderSingleShortlist(name);
    } else {
        applyFilters();
    }
    
    updateTravelSidebarHighlight();
}

function renderWelcomeScreen() {
    const wName = document.getElementById('welcome-name');
    const wAvatar = document.getElementById('welcome-avatar');
    if(wName) wName.innerText = userProfile.name || 'GUEST';
    if(wAvatar && userProfile.avatar) wAvatar.src = `Profile_images/${userProfile.avatar}`;
    welcomeScreen?.classList.remove('hidden');
}

function renderDiscountsView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    if(resultsContainer) resultsContainer.innerHTML = '';
    document.getElementById('discounts-container')?.classList.remove('hidden');
}

// v0.41 - Tutorial System Functions with Red Border Highlight
window.startMainTutorial = function() {
    tutorialSteps = [
        { target: 'search-input', text: 'Search by city, venue name, or vibe here.' },
        { target: 'main-filters', text: 'Swipe horizontally and tap these pills to filter venues by specific features like Dresscode or Sauna.' },
        { target: 'btn-location', text: 'Tap here to set your travel destination or lock in your GPS location.' },
        { target: 'sidebar-hit-area', text: 'Tap the left edge (or swipe right) to open the main menu for shortlists, travel, and settings.' },
        { target: null, text: 'You are all set! Tap a venue card to view full details.' }
    ];
    currentTutorialStep = 0;
    document.getElementById('tutorial-modal')?.classList.remove('hidden');
    window.showTutorialStep();
};

window.startProfileTutorial = function() {
    tutorialSteps = [
        { target: 'profile-name', text: 'Your profile settings and shortlists are stored LOCALLY on this device only.' },
        { target: 'btn-settings', text: 'We do not have a server. If you clear your browser cache, you will lose everything.' },
        { target: 'btn-export-trigger', text: 'To backup your data, use the Export feature in settings. Save the file to your cloud drive so you can import it later!' }
    ];
    currentTutorialStep = 0;
    profileModal?.classList.add('hidden'); 
    document.getElementById('tutorial-modal')?.classList.remove('hidden');
    window.showTutorialStep();
};

window.showTutorialStep = function() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    if(currentTutorialStep >= tutorialSteps.length) { window.endTutorial(); return; }
    
    const step = tutorialSteps[currentTutorialStep];
    if (step.target) {
        const targetEl = document.getElementById(step.target);
        if(targetEl) {
            targetEl.classList.add('tutorial-highlight');
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    const textEl = document.getElementById('tutorial-text');
    if(textEl) textEl.innerText = step.text;
};

window.nextTutorialStep = function() {
    currentTutorialStep++;
    window.showTutorialStep();
};

window.endTutorial = function() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    document.getElementById('tutorial-modal')?.classList.add('hidden');
};

function setupEventListeners() {
    const addEvt = (id, evt, func) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(evt, func);
    };

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => e.target.closest('.modal')?.classList.add('hidden'));
    });
    
    addEvt('close-modal', 'click', () => {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        handleRouting();
    });

    addEvt('btn-location', 'click', () => {
        if(window.location.hash !== '') window.location.hash = '';
        locModal?.classList.remove('hidden');
    });
    
    addEvt('btn-settings', 'click', () => settingsModal?.classList.remove('hidden'));
    addEvt('btn-profile-menu', 'click', openProfileMenu);
    addEvt('btn-favorites', 'click', () => window.location.hash = '#favorites');
    addEvt('btn-shortlists-menu', 'click', () => window.location.hash = '#myshortlists');
    
    addEvt('btn-sidebar-tutorial', 'click', () => { 
        document.getElementById('sidebar')?.classList.remove('visible'); 
        window.startMainTutorial(); 
    });
    addEvt('btn-profile-tutorial', 'click', window.startProfileTutorial);

    addEvt('btn-sidebar-travel', 'click', () => {
        const drop = document.getElementById('travel-dropdown');
        drop?.classList.toggle('hidden');
        renderTravelDropdown();
    });

    addEvt('btn-language', 'click', () => alert("Translation widget placeholder"));
    addEvt('btn-back-to-results', 'click', () => {
        if(searchInput) searchInput.value = '';
        window.location.hash = '';
        updateTravelSidebarHighlight();
    });

    addEvt('btn-save-location', 'click', saveLocation);
    addEvt('btn-clear-location', 'click', clearLocation);
    
    addEvt('btn-gps', 'click', () => {
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => { 
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const cityInput = document.getElementById('loc-city');
                    
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await res.json();
                        const city = data.address.city || data.address.town || data.address.village || 'My Location';
                        if(cityInput) {
                            cityInput.value = city;
                            cityInput.dataset.lat = lat;
                            cityInput.dataset.lon = lon;
                        }
                        const countryInput = document.getElementById('loc-country');
                        if(countryInput) countryInput.value = data.address.country || '';
                    } catch (e) {
                        if(cityInput) cityInput.value = `My Location`;
                    }
                    initLeafletMap(lat, lon);
                },
                (err) => { alert("GPS Denied or Unavailable."); }
            );
        } else alert("Geolocation not supported.");
    });

    addEvt('btn-search-map', 'click', async () => {
        const country = document.getElementById('loc-country')?.value.trim() || '';
        const city = document.getElementById('loc-city')?.value.trim() || '';
        const pc = document.getElementById('loc-postcode')?.value.trim() || '';
        const query = `${pc} ${city}, ${country}`.trim();
        
        if(!query) return;
        
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if(data && data.length > 0) {
                initLeafletMap(data[0].lat, data[0].lon);
            } else {
                alert("Location not found on map, but will be saved for filtering.");
            }
        } catch(e) {
            console.error("OSM Error", e);
        }
    });

    addEvt('btn-save-travel', 'click', () => {
        const cityInp = document.getElementById('loc-city');
        if(!cityInp) return;
        const city = cityInp.value.trim();
        if(city && city !== 'My Location' && !userTravel.includes(city)) {
            userTravel.push(city);
            saveCurrentToBundle();
            showToast(`Saved to Travel 🚄: ${city}`);
            cityInp.value = '';
            if(window.location.hash === '#mytravel') renderTravelFullView();
            else renderTravelDropdown();
        }
    });

    addEvt('btn-reset-age', 'click', () => {
        localStorage.removeItem('br_age_verified');
        window.location.reload();
    });
    
    addEvt('btn-clear-data', 'click', () => {
        if(confirm("Delete all favorites, shortlists, events, and settings? This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
    
    document.querySelectorAll('.btn-export-trigger').forEach(btn => btn.addEventListener('click', exportUserData));
    addEvt('import-data-file', 'change', importUserData);

    addEvt('btn-add-create-shortlist', 'click', () => {
        const nameInp = document.getElementById('add-new-shortlist-name');
        if(!nameInp) return;
        const name = nameInp.value.trim();
        if(name && currentTargetVenue) { 
            userShortlists[name] = [currentTargetVenue.Venue_ID]; 
            saveCurrentToBundle(); 
            addShortlistModal?.classList.add('hidden');
            showToast(`Added to shortlist: ${name}`);
            const sBtn = document.getElementById('modal-shortlist');
            if(sBtn) sBtn.classList.add('active-star');
        }
    });
    
    addEvt('btn-save-profile', 'click', () => {
        const nameInp = document.getElementById('profile-name');
        if(nameInp) userProfile.name = nameInp.value.trim();
        saveCurrentToBundle(); 
        profileModal?.classList.add('hidden');
        updateProfileDisplay();
        showToast("Profile saved locally!");
        if(window.location.hash === '' && searchInput?.value === '') renderWelcomeScreen();
    });

    addEvt('btn-new-profile', 'click', () => {
        document.getElementById('profile-wipe-toast')?.classList.remove('hidden');
    });

    addEvt('btn-wipe-all', 'click', () => {
        userProfile = { name: '', avatar: 'noavatar01.png' };
        userFavorites = []; userShortlists = {}; userEvents = []; userTravel = [];
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Started fresh blank profile.");
        handleRouting();
    });

    addEvt('btn-wipe-profile-only', 'click', () => {
        userProfile = { name: '', avatar: 'noavatar01.png' };
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Profile copied. Choose a new name.");
    });

    addEvt('profile-switcher', 'change', (e) => {
        const pName = e.target.value;
        if(pName && savedProfiles[pName]) {
            userProfile = { ...savedProfiles[pName] };
            const nInp = document.getElementById('profile-name');
            if(nInp) nInp.value = userProfile.name;
            loadActiveProfileData();
            renderProfileAvatars();
            updateProfileDisplay();
            showToast(`Switched to profile: ${pName}`);
            handleRouting();
        }
    });

    if(hitArea && sidebar) {
        const showSidebar = () => {
            sidebar.classList.add('visible');
            clearTimeout(sidebarTimeout);
            sidebarTimeout = setTimeout(() => { sidebar.classList.remove('visible'); }, 5000);
        };
        hitArea.addEventListener('click', showSidebar);
        sidebar.addEventListener('click', showSidebar);
    }

    if(searchInput) {
        searchInput.addEventListener('input', () => { recordUserInteraction(); window.location.hash=''; handleRouting(); });
    }
    
    // Allows dynamically generated pills to work
    document.addEventListener('click', (e) => {
        if(e.target.classList.contains('chip') && e.target.closest('#main-filters')) {
            recordUserInteraction();
            document.querySelectorAll('#main-filters .chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.getAttribute('data-filter');
            window.location.hash=''; 
            handleRouting();
        }
    });
}

function initLeafletMap(lat, lng) {
    document.getElementById('map-preview-placeholder')?.classList.add('hidden');
    const mapDiv = document.getElementById('loc-map');
    if(!mapDiv) return;
    mapDiv.style.display = 'block';
    
    if (!leafletMap) {
        leafletMap = L.map('loc-map').setView([lat, lng], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(leafletMap);
        leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
    } else {
        leafletMap.setView([lat, lng], 13);
        leafletMarker.setLatLng([lat, lng]);
    }
    setTimeout(() => leafletMap.invalidateSize(), 150);
}

function updateProfileDisplay() {
    const topAvatarContainer = document.getElementById('top-profile-container');
    const topAvatar = document.getElementById('top-profile-avatar');
    const topName = document.getElementById('top-profile-name');
    
    if(!topName || !topAvatar) return;

    if(userProfile.name) topName.innerText = userProfile.name;
    else topName.innerText = '👤';

    if(userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        topAvatar.src = `Profile_images/${userProfile.avatar}`;
        if(topAvatarContainer) topAvatarContainer.style.display = 'block'; 
        else topAvatar.style.display = 'inline-block';
        
        if(!userProfile.name) topName.style.display = 'none'; 
    } else {
        if(topAvatarContainer) topAvatarContainer.style.display = 'none';
        else topAvatar.style.display = 'none';
        topName.style.display = 'inline-block';
    }
}

function renderTravelDropdown() {
    const list = document.getElementById('travel-cities-list');
    if(!list) return;
    list.classList.remove('hidden');
    list.innerHTML = '';
    
    const query = searchInput?.value.trim().toLowerCase() || '';

    userTravel.forEach(city => {
        const item = document.createElement('div');
        const isActive = query === city.toLowerCase() ? 'active-travel' : '';
        item.className = `submenu-item ${isActive}`;
        item.innerHTML = `<span style="flex-grow:1;" onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash=''; handleRouting();">${city}</span>`;
        list.appendChild(item);
    });
}

// =================== part 2 ================
// =================== part 2 ================

function updateTravelSidebarHighlight() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    const items = document.querySelectorAll('#travel-cities-list .submenu-item');
    items.forEach(item => {
        const spanText = item.querySelector('span').innerText.toLowerCase();
        if(spanText === query && window.location.hash === '') {
            item.classList.add('active-travel');
        } else {
            item.classList.remove('active-travel');
        }
    });
}

window.removeTravel = function(city) {
    userTravel = userTravel.filter(c => c !== city);
    saveCurrentToBundle();
    if(window.location.hash === '#mytravel') renderTravelFullView();
    else renderTravelDropdown();
}

// v0.41 - Dynamic Tags Generator based on current results
function renderDynamicFilters(baseVenues) {
    const filterContainer = document.getElementById('main-filters');
    if (!filterContainer) return;

    const masterList = ["Cruise", "Darkroom", "Fetish", "Leather", "Rubber", "Gear", "Sportswear", "Sneakers", "Naked", "Underwear", "Dresscode", "Men Only", "Bear", "Mature", "Young Crowd", "Queer", "Drag", "Karaoke", "Pop/Dance", "Techno", "Sauna", "Puppy"];
    const featureMap = {
        "Feature_Darkroom": "Darkroom",
        "Feature_Men_Only": "Men Only",
        "Feature_Dresscode": "Dresscode",
        "Feature_Smoking_Area": "Smoking Area",
        "Feature_Cruise_Focused": "Cruising",
        "Feature_Dancefloor": "Dancefloor",
        "Feature_Sauna": "Sauna"
    };

    let availableTags = new Set();
    baseVenues.forEach(v => {
        if (v.Vibe_Tags) {
            masterList.forEach(tag => {
                if (v.Vibe_Tags.toLowerCase().includes(tag.toLowerCase())) availableTags.add(tag);
            });
        }
        Object.keys(featureMap).forEach(key => {
            if (v[key]) availableTags.add(featureMap[key]);
        });
    });

    let html = `<button class="chip pill-btn ${activeFilter === 'All' ? 'active' : ''}" data-filter="All">All</button>
                <button class="chip pill-btn ${activeFilter === 'Open Now' ? 'active' : ''}" data-filter="Open Now">Open Now</button>`;

    const orderedTags = masterList.concat(Object.values(featureMap)).filter((item, pos, self) => self.indexOf(item) === pos);
    orderedTags.forEach(tag => {
        if (availableTags.has(tag)) {
            html += `<button class="chip pill-btn ${activeFilter === tag ? 'active' : ''}" data-filter="${tag}">${tag}</button>`;
        }
    });

    filterContainer.innerHTML = html;
}

function applyFilters() {
    const query = searchInput?.value || '';
    let baseVenues = venues || [];
    selectedCardId = null;

    if(query.trim() !== '') {
        baseVenues = baseVenues.filter(v => fuzzyMatch(v.Name + " " + v.Description + " " + (v.Vibe_Tags||'') + " " + v.City, query));
    }

    renderDynamicFilters(baseVenues);

    let filteredVenues = baseVenues;
    if(activeFilter !== 'All') {
        filteredVenues = filteredVenues.filter(v => {
            if(activeFilter === 'Open Now') return v.Status === 'Live';
            
            // Feature Booleans
            if(activeFilter === 'Darkroom') return v.Feature_Darkroom;
            if(activeFilter === 'Men Only') return v.Feature_Men_Only;
            if(activeFilter === 'Dresscode') return v.Feature_Dresscode;
            if(activeFilter === 'Smoking Area') return v.Feature_Smoking_Area;
            if(activeFilter === 'Cruising') return v.Feature_Cruise_Focused;
            if(activeFilter === 'Dancefloor') return v.Feature_Dancefloor;
            if(activeFilter === 'Sauna') return v.Feature_Sauna;
            
            // Vibe_Tags
            if(v.Vibe_Tags && typeof v.Vibe_Tags === 'string') {
                return v.Vibe_Tags.toLowerCase().includes(activeFilter.toLowerCase());
            }
            return false;
        });
    }

    renderListings(filteredVenues);
    updateTravelSidebarHighlight();
}

function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
}

function fuzzyMatch(text, query) {
    if(!query) return true;
    const str = (text||'').toLowerCase();
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
                if(getLevenshteinDistance(w, qw) <= 1) { matchFound = true; break; }
            }
        }
        if(!matchFound) return false; 
    }
    return true;
}

function toggleFavorite(id, btnElement) {
    const index = userFavorites.indexOf(id);
    if(index > -1) {
        userFavorites.splice(index, 1);
        btnElement?.classList.remove('active-star');
        showToast("Removed from Favourites");
    } else {
        userFavorites.push(id);
        btnElement?.classList.add('active-star');
        showToast("Added to Favourites ⚜️");
    }
    saveCurrentToBundle();
    if(window.location.hash === '#favorites') renderFavoritesView();
}

window.toggleEventFavorite = function(eventId, btnElement, isRemovalView = false) {
    const index = userEvents.indexOf(eventId);
    if(index > -1) {
        if(isRemovalView && !confirm("Remove this event from your list?")) return;
        userEvents.splice(index, 1);
        btnElement?.classList.remove('active-star');
        if(!isRemovalView) showToast("Removed from Events");
    } else {
        userEvents.push(eventId);
        btnElement?.classList.add('active-star');
        showToast("Saved to 💖 Events");
    }
    saveCurrentToBundle();
    if(window.location.hash === '#myevents') renderMyEventsView();
}

function renderFavoritesView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "⚜️ MY FAVOURITES";
    if(cDesc) cDesc.innerText = "Venues you have starred locally.";
    
    const favVenues = (venues||[]).filter(v => userFavorites.includes(v.Venue_ID));
    renderListings(favVenues, true);
}

function renderMyEventsView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "💖 MY EVENTS";
    if(cDesc) cDesc.innerText = "Events you have pinned locally.";
    
    const cityFilterContainer = document.getElementById('event-city-filters');
    if(cityFilterContainer) {
        cityFilterContainer.classList.remove('hidden');
        cityFilterContainer.innerHTML = '';
    }
    
    let myEvts = (events||[]).filter(e => userEvents.includes(e.Event_ID));
    
    if(myEvts.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No saved events.</p>`;
        cityFilterContainer?.classList.add('hidden');
        return;
    }

    const cities = new Set();
    myEvts.forEach(ev => {
        const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
        if(venue && venue.City) cities.add(venue.City);
    });

    const createCityBtn = (cityName, label) => {
        if(!cityFilterContainer) return;
        const btn = document.createElement('button');
        btn.className = `chip pill-btn ${currentEventCityFilter === cityName ? 'active' : ''}`;
        btn.innerText = label;
        btn.onclick = () => { currentEventCityFilter = cityName; renderMyEventsView(); };
        cityFilterContainer.appendChild(btn);
    };

    createCityBtn('All', 'All');
    cities.forEach(city => createCityBtn(city, city));

    if(currentEventCityFilter !== 'All') {
        myEvts = myEvts.filter(ev => {
            const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
            return venue && venue.City === currentEventCityFilter;
        });
    }

    if(resultsContainer) resultsContainer.innerHTML = '';
    myEvts.forEach(ev => {
        const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
        const venueName = venue ? venue.Name : 'Unknown Venue';
        const card = document.createElement('div');
        card.className = 'card';
        card.style.border = '1px solid var(--primary-blue)';
        card.innerHTML = `
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${ev.Event_Name}</h3><div class="card-meta">${formatDateToDDMMYYYY(ev.Event_Date)} | @ ${venueName}</div></div>
                    <button class="icon-btn fav-btn active-star" style="font-size:1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', null, true)">❌</button>
                </div>
                <div class="card-about">${ev.Event_Description || ''}</div>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

function renderTravelFullView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "🚄 MY TRAVEL PINS";
    if(cDesc) cDesc.innerText = "Cities you plan to visit.";
    
    if(resultsContainer) resultsContainer.innerHTML = '';

    if(userTravel.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No travel pins saved yet.</p>`;
        return;
    }

    userTravel.forEach(city => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash=''; handleRouting();" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${city}</h3>
                </div>
                <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete ${city}?')){ removeTravel('${city}'); }">❌</button>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

function renderShortlistsFullView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "📑 MY SHORTLISTS";
    if(cDesc) cDesc.innerText = "Your named venue collections.";
    
    const newBtn = document.getElementById('btn-new-shortlist-view');
    if(newBtn) {
        newBtn.classList.remove('hidden');
        newBtn.onclick = () => {
            const name = prompt("Enter new shortlist name:");
            if(name && name.trim() !== '') {
                userShortlists[name.trim()] = [];
                saveCurrentToBundle();
                renderShortlistsFullView();
            }
        };
    }

    if(resultsContainer) resultsContainer.innerHTML = '';
    const lists = Object.keys(userShortlists);

    if(lists.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No shortlists created yet.</p>`;
        return;
    }

    lists.forEach(name => {
        const count = userShortlists[name].length;
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div onclick="window.location.hash='#shortlist=${encodeURIComponent(name)}';" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${name}</h3>
                    <p class="meta-text" style="margin-top:5px;">${count} venue${count === 1 ? '' : 's'}</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="icon-btn" onclick="shareShortlist('${name}')" title="Share"><img src="link.png" style="width:20px;"></button>
                    <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete shortlist ${name}?')){ delete userShortlists['${name}']; saveCurrentToBundle(); renderShortlistsFullView(); }">❌</button>
                </div>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

function renderSingleShortlist(listName) {
    if(!userShortlists[listName]) { window.location.hash=''; return; }
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerText = listName.toUpperCase();
    if(cDesc) cDesc.innerText = "Saved Shortlist";
    
    const ids = userShortlists[listName];
    const shortVenues = (venues||[]).filter(v => ids.includes(v.Venue_ID));
    renderListings(shortVenues, true);
}

function renderProfileAvatars() {
    const grid = document.getElementById('avatar-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const switcher = document.getElementById('profile-switcher');
    if (switcher) {
        switcher.innerHTML = '<option value="">Switch Profile...</option>';
        Object.keys(savedProfiles).forEach(pName => {
            switcher.innerHTML += `<option value="${pName}">${pName}</option>`;
        });
    }

    let filterContainer = document.getElementById('avatar-filters');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'avatar-filters';
        filterContainer.style.display = 'flex';
        filterContainer.style.gap = '8px';
        filterContainer.style.marginBottom = '15px';
        filterContainer.style.overflowX = 'auto';
        grid.parentNode.insertBefore(filterContainer, grid);
    }
    
    const cats = ['All', 'Young', 'Prime', 'Mature', 'Ink', 'Leather', 'Rubber', 'Puppy'];
    filterContainer.innerHTML = '';
    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `chip pill-btn ${activeAvatarCategory === c ? 'active' : ''}`;
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '0.85rem';
        btn.innerText = c;
        btn.onclick = () => { activeAvatarCategory = c; renderProfileAvatars(); };
        filterContainer.appendChild(btn);
    });

    const filteredData = activeAvatarCategory === 'All' ? avatarData : avatarData.filter(a => {
        if (Array.isArray(a.category)) return a.category.includes(activeAvatarCategory);
        return a.category === activeAvatarCategory;
    });

    filteredData.forEach(avatar => {
        // Hide default avatar unless specifically viewing All
        if(activeAvatarCategory !== 'All' && avatar.file === 'noavatar01.png') return;

        const item = document.createElement('div');
        item.className = 'avatar-item';
        
        let avToMatch = userProfile.avatar || 'noavatar01.png';
        if(avToMatch === avatar.file) item.classList.add('selected');
        
        // v0.41 - Removed tagsHtml to only show avatar names
        item.innerHTML = `
            <div class="avatar-image-wrap">
                <img src="Profile_images/${avatar.file}" onerror="this.parentElement.style.display='none';" alt="${avatar.label}">
            </div>
            <span class="avatar-label">${avatar.label}</span>
        `;
        
        item.addEventListener('click', () => {
            if (item.classList.contains('selected')) {
                document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected', 'hidden'));
                userProfile.avatar = 'noavatar01.png';
            } else {
                document.querySelectorAll('.avatar-item').forEach(el => {
                    el.classList.remove('selected');
                    if (el !== item) el.classList.add('hidden');
                });
                item.classList.add('selected');
                userProfile.avatar = avatar.file;
                showToast("Click the avatar again to go back to the list");
            }
        });
        grid.appendChild(item);
    });
}

function renderProfileStats() {
    const container = document.getElementById('profile-stats-container');
    if(!container) return;
    
    const favCount = userFavorites.length;
    const eventCount = userEvents.length;
    const shortCount = Object.keys(userShortlists).length;
    const travelCount = userTravel.length;
    
    let html = `
        <hr style="border: 0; height: 2px; background: var(--bright-red-orange); margin: 20px 0;">
        <h3 style="color: var(--primary-blue); margin-bottom: 15px; font-size: 1.2rem;" class="display-font">YOUR PROFILE CONTAINS</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    const createStatHtml = (title, count, items, icon) => {
        let itemsHtml = items.length > 0 ? `<div class="hidden meta-text" style="padding-left:30px; margin-top:8px; font-size:0.95rem; line-height: 1.4; color: var(--text-light);">${items.join('<br>')}</div>` : '<div class="hidden meta-text" style="padding-left:30px; margin-top:8px; font-size:0.95rem; color: var(--text-light);">None</div>';
        return `
            <div style="background: var(--panel-dark); border: 1px solid var(--panel-mid); padding: 12px; border-radius: var(--radius-card); cursor: pointer;" onclick="const d=this.querySelector('.meta-text'); if(d) d.classList.toggle('hidden');">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size: 1.05rem; display:flex; align-items:center; gap:8px;">${icon} <span>${title}</span></strong>
                    <span style="background:var(--primary-blue); color:#fff; padding:3px 10px; border-radius:var(--radius-pill); font-size:0.9rem; font-weight: bold;">${count}</span>
                </div>
                ${itemsHtml}
            </div>
        `;
    };

    const favNames = userFavorites.map(id => {
        const v = venues.find(v => v.Venue_ID === id);
        return v ? v.Name : id;
    });
    const eventNames = userEvents.map(id => {
        const e = events.find(e => e.Event_ID === id);
        return e ? e.Event_Name : id;
    });
    const shortNames = Object.keys(userShortlists);
    
    html += createStatHtml('Saved Locations', travelCount, userTravel, '<img src="location.png" style="width:18px;">');
    html += createStatHtml('Shortlists', shortCount, shortNames, '<img src="shortlist.png" style="width:18px;">');
    html += createStatHtml('Saved Events', eventCount, eventNames, '💖');
    html += createStatHtml('Saved Venues', favCount, favNames, '⚜️');
    
    html += `</div>`;
    container.innerHTML = html;
}

function openProfileMenu() {
    const pName = document.getElementById('profile-name');
    if(pName) pName.value = userProfile.name || '';
    renderProfileAvatars();
    renderProfileStats();
    profileModal?.classList.remove('hidden');
}

function promptAddToShortlist(venue) {
    currentTargetVenue = venue;
    const tName = document.getElementById('add-shortlist-target-name');
    if(tName) tName.innerText = venue.Name;
    const container = document.getElementById('add-shortlist-options');
    if(!container) return;
    
    container.innerHTML = '';
    
    const lists = Object.keys(userShortlists);
    if(lists.length === 0) {
        container.innerHTML = '<p class="meta-text">No shortlists exist.</p>';
    } else {
        lists.forEach(name => {
            const isAdded = userShortlists[name].includes(venue.Venue_ID);
            const btn = document.createElement('button');
            btn.className = `btn pill-btn ${isAdded ? 'secondary-btn' : 'primary-btn'}`;
            btn.innerText = isAdded ? `Remove from ${name}` : `Add to ${name}`;
            btn.addEventListener('click', () => {
                if(isAdded) {
                    userShortlists[name] = userShortlists[name].filter(id => id !== venue.Venue_ID);
                } else {
                    userShortlists[name].push(venue.Venue_ID);
                }
                saveCurrentToBundle();
                addShortlistModal?.classList.add('hidden');
                showToast(isAdded ? "Removed from Shortlist" : "Added to Shortlist");
                
                const sBtn = document.getElementById('modal-shortlist');
                const isNowShortlisted = Object.values(userShortlists).some(list => list.includes(venue.Venue_ID));
                if(sBtn) {
                    if(isNowShortlisted) sBtn.classList.add('active-star');
                    else sBtn.classList.remove('active-star');
                }
            });
            container.appendChild(btn);
        });
    }
    addShortlistModal?.classList.remove('hidden');
}

function exportUserData() {
    const data = {
        profile: userProfile,
        saved_profiles: savedProfiles,
        favorites: userFavorites,
        shortlists: userShortlists,
        events: userEvents,
        travel: userTravel,
        location: JSON.parse(localStorage.getItem('br_location') || 'null')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `backroom_userdata_${new Date().toISOString().split('T')[0]}.json`; 
    a.click();
}

function importUserData(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if(data.profile) { userProfile = data.profile; localStorage.setItem('br_profile', JSON.stringify(userProfile)); }
            if(data.saved_profiles) { savedProfiles = data.saved_profiles; localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles)); }
            if(data.favorites) { userFavorites = data.favorites; saveUserFavorites(); }
            if(data.shortlists) { userShortlists = data.shortlists; saveUserShortlists(); }
            if(data.events) { userEvents = data.events; saveUserEvents(); }
            if(data.travel) { userTravel = data.travel; localStorage.setItem('br_travel', JSON.stringify(userTravel)); }
            if(data.location) { localStorage.setItem('br_location', JSON.stringify(data.location)); updateLocationDisplay(data.location); }
            
            importInfo = { date: new Date().toLocaleString(), filename: file.name, userName: userProfile.name || 'Anonymous' };
            localStorage.setItem('br_import_info', JSON.stringify(importInfo));
            
            showToast("Data imported successfully!");
            setTimeout(() => window.location.reload(), 1000);
        } catch(err) {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
}

function checkImportPreview() {
    const previewBox = document.getElementById('import-preview-info');
    if(importInfo && previewBox) {
        previewBox.innerHTML = `<strong>Current Active File:</strong><br>Name: ${importInfo.userName}<br>File: ${importInfo.filename}<br>Loaded: ${importInfo.date}`;
        previewBox.classList.remove('hidden');
    }
}

function handleImageCarousel(imgElement) {
    imgElement.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const id = imgElement.getAttribute('data-id');
        let index = parseInt(imgElement.getAttribute('data-index') || '1') + 1;
        let numStr = index < 10 ? '0' + index : index;
        let newSrc = `Venue_images/${id}-${numStr}.jpg`;
        
        let tempImg = new Image();
        tempImg.onload = () => {
            imgElement.src = newSrc;
            imgElement.setAttribute('data-index', index);
            showToast("Double tap the venue name to open");
        };
        tempImg.onerror = () => {
            imgElement.src = `Venue_images/${id}-01.jpg`;
            imgElement.setAttribute('data-index', 1);
            showToast("Double tap the venue name to open");
        };
        tempImg.src = newSrc;
    });
}

function renderListings(data, isContextView = false) {
    if(resultsContainer) resultsContainer.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);

    if(!data || data.length === 0) {
        let emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No venues found.</p>`;
        
        const cityInput = document.getElementById('loc-city');
        const userLat = parseFloat(cityInput?.dataset.lat || 'NaN');
        const userLon = parseFloat(cityInput?.dataset.lon || 'NaN');
        
        if (!isNaN(userLat) && !isNaN(userLon) && venues.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            venues.forEach(v => {
                const dist = getDistanceFromLatLonInKm(userLat, userLon, parseFloat(v.Latitude), parseFloat(v.Longitude));
                if (dist < minDist) { minDist = dist; nearest = v; }
            });
            
            if (nearest && minDist !== Infinity) {
                const distRounded = Math.round(minDist);
                emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">
                    <img src="location.png" style="width:40px; margin-bottom:10px;"><br>
                    <span style="color: var(--bright-red-orange); font-family: 'Antonio', sans-serif; font-size: 1.5rem; text-transform: uppercase;">No venues found nearby</span><br><br>
                    <a href="javascript:void(0)" onclick="const s = document.getElementById('search-input'); if(s) s.value='${nearest.City}'; applyFilters();" style="color:var(--primary-blue); font-weight:bold; font-size:1.1rem; text-decoration:underline;">
                        Closest venue is ${distRounded} km away in ${nearest.City}.<br>Click here to load ${nearest.City}.
                    </a>
                </p>`;
            }
        }
        if(resultsContainer) resultsContainer.innerHTML = emptyHtml;
        return;
    }

    data.forEach(venue => {
        let nextEventHtml = '';
        let venueEvents = (events||[]).filter(e => e.Venue_ID === venue.Venue_ID && new Date(e.Event_Date) >= today);
        if(venueEvents.length > 0) {
            venueEvents.sort((a, b) => new Date(a.Event_Date) - new Date(b.Event_Date));
            const nextE = venueEvents[0];
            nextEventHtml = `<div class="card-next-event">📅 Next: ${nextE.Event_Name} (${formatDateToDDMMYYYY(nextE.Event_Date)})</div>`;
        }

        const isFav = userFavorites.includes(venue.Venue_ID);
        const shortDesc = venue.Description.length > 90 ? venue.Description.substring(0, 90) + '...' : venue.Description;
        const card = document.createElement('div');
        card.className = 'card';
        
        const baseImageSrc = `Venue_images/${venue.Venue_ID}-01.jpg`;
        
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img class="venue-image centered-image" src="${baseImageSrc}" onerror="this.src='placeholder_venue.jpg'" data-id="${venue.Venue_ID}" data-index="1" title="Tap to see next photo">
            </div>
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${venue.Name}</h3><div class="card-meta"><img src="location.png" style="width:14px; vertical-align:middle;"> ${venue.City}</div></div>
                    <div class="status-badge ${venue.Status.toLowerCase()}">${venue.Status.toUpperCase()}</div>
                </div>
                <div class="card-about">${shortDesc}</div>
                ${nextEventHtml}
                <div class="card-stats">
                    <span>🌈 ${systemInfo.labels?.rated_by_gays || 'Rated by gays'}</span><span>👁️ ${venue.Views || 0}</span>
                    <span class="star-btn icon-btn fav-btn ${isFav ? 'active-star' : ''}" style="margin-left:auto; font-size:1.8rem; line-height:1;">⚜️</span>
                </div>
            </div>
        `;
        
        handleImageCarousel(card.querySelector('.venue-image'));

        card.addEventListener('click', (e) => { 
            if(e.target.classList.contains('star-btn')) {
                toggleFavorite(venue.Venue_ID, e.target);
            } else if (!e.target.classList.contains('venue-image')) {
                if(selectedCardId === venue.Venue_ID) {
                    recordUserInteraction();
                    window.location.hash = `#venue=${venue.Venue_ID}`; 
                } else {
                    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedCardId = venue.Venue_ID;
                    showToast("Double tap the venue name to open");
                }
            } 
        });
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

function getRatingCells(val, type) {
    let html = '';
    for(let i=1; i<=5; i++) {
        const op = i <= val ? '1' : '0.25';
        let asset = '';
        
        let iconSize = '26px';
        if (type === 'Age' || type === 'Popularity') {
            iconSize = '31.2px';
        }
        
        if (type === 'Size') {
            asset = `<img src="Emoji/size0${i}.png" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else if (type === 'Age') {
            asset = `<img src="Emoji/age0${i}.png" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else {
            const map = { 'General': 'eggplant', 'Darkroom': 'water', 'Cost': 'money', 'Location': 'peach', 'Popularity': 'busy' };
            const prefix = map[type] || 'eggplant';
            asset = `<img src="Emoji/${prefix}0${i}.png" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        }
        
        html += `<div style="opacity:${op}; display:flex; align-items:center; justify-content:center;">${asset}</div>`;
    }
    return html;
}

function openVenueModal(venue) {
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.innerText = venue.Name;
    
    const dynamicLayout = document.getElementById('modal-dynamic-layout');
    if(!dynamicLayout) return;

    const features = [];
    if(venue.Feature_Darkroom) features.push('Darkroom');
    if(venue.Feature_Men_Only) features.push('Men Only');
    if(venue.Feature_Dancefloor) features.push('Dancefloor');
    if(venue.Feature_Sauna) features.push('Sauna');
    const featureHtml = features.map(f => `<span class="chip pill-btn" style="font-size:0.85rem; padding: 4px 10px;">${f}</span>`).join('');

    const statsHtml = `
        <div class="public-stats-block">
            <span>🌈 ${systemInfo.labels?.rated_by_gays || 'Rated'}</span> 
            <span>👁️ ${venue.Views || 0}</span>
        </div>
        ${buildSocialBar(venue)}
        <div class="feature-chips" style="margin-top: 15px;">${featureHtml}</div>
    `;
    
    // v0.41 - Renamed General to Overall, moved to top
    const ratingTypes = [
        { label: 'Overall', key: 'Rating_General', type: 'General' },
        { label: 'Age Range', key: 'Rating_Age_Range', type: 'Age' },
        { label: 'Size', key: 'Rating_Size', type: 'Size' },
        { label: 'Darkroom', key: 'Rating_Darkroom', type: 'Darkroom' },
        { label: 'Cost', key: 'Rating_Cost', type: 'Cost' },
        { label: 'Location', key: 'Rating_Location', type: 'Location' },
        { label: 'Popularity', key: 'Rating_Busyness', type: 'Popularity' }
    ];

    let ratingsTableHtml = `<div style="display: grid; grid-template-columns: 1fr repeat(5, 30px); gap: 8px 2px; align-items: center; background-color: var(--near-black); padding: 15px; border-radius: var(--radius-card); border: 1px solid var(--panel-mid);">`;
    
    ratingsTableHtml += `
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: left; padding-right: 10px;">FEATURE</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">1</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">2</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">3</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">4</div>
        <div style="font-size: 0.9rem; color: var(--primary-blue); font-weight: bold; text-align: center;">5</div>
    `;
    
    ratingTypes.forEach(r => {
        const val = venue[r.key];
        // v0.41 - NA check using grid-column span 5
        if(val === 'NA' || val === 'N/A' || val == null) {
            ratingsTableHtml += `
                <div style="font-size: 1rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding-right: 10px;">${r.label}</div>
                <div style="grid-column: span 5; font-size: 0.95rem; color: var(--label-grey); text-align: center; font-style: italic;">Not yet rated</div>
            `;
        } else {
            ratingsTableHtml += `
                <div style="font-size: 1rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding-right: 10px;">${r.label}</div>
                ${getRatingCells(Number(val), r.type)}
            `;
        }
    });
    
    ratingsTableHtml += `</div>`;

    let venueEvents = (events||[]).filter(e => e.Venue_ID === venue.Venue_ID);
    const today = new Date(); today.setHours(0,0,0,0);
    venueEvents.sort((a, b) => {
        const dateA = new Date(a.Event_Date); const dateB = new Date(b.Event_Date);
        const isPastA = dateA < today; const isPastB = dateB < today;
        if (isPastA && !isPastB) return 1; if (!isPastA && isPastB) return -1;
        return Math.abs(dateA - today) - Math.abs(dateB - today);
    });

    let eventsHtml = '';
    if(venueEvents.length > 0) {
        eventsHtml = `<div class="events-block"><h3 class="display-font">UPCOMING EVENTS</h3>`;
        venueEvents.forEach(ev => {
            const isPast = new Date(ev.Event_Date) < today;
            const isSaved = userEvents.includes(ev.Event_ID);
            const badgeData = getBadgeDateParts(ev.Event_Date);
            eventsHtml += `
                <div class="event-card ${isPast ? 'past' : ''}">
                    <div class="event-card-inner">
                        <div class="event-date-badge">
                            <span class="day">${badgeData.d}</span>
                            <span class="month-year">${badgeData.my}</span>
                        </div>
                        <div class="event-card-details">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <strong>${ev.Event_Name}</strong> ${isPast ? '<small>(Past)</small>' : ''}<br>
                                    <span class="meta-text">${formatDateToDDMMYYYY(ev.Event_Date)} | ${ev.Event_Start_Time}</span>
                                </div>
                                <button class="icon-btn fav-btn ${isSaved ? 'active-star' : ''}" style="font-size: 1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', this)">💖</button>
                            </div>
                            <p style="font-size:0.9rem; margin-top:5px;">${ev.Event_Description}</p>
                        </div>
                    </div>
                </div>`;
        });
        eventsHtml += `</div>`;
    }

    dynamicLayout.innerHTML = `
        <div class="modal-top-split">
            <div class="modal-left-col">
                <div class="modal-image-container">
                    <img id="modal-venue-image" class="venue-image centered-image" src="Venue_images/${venue.Venue_ID}-01.jpg" onerror="this.src='placeholder_venue.jpg'" data-id="${venue.Venue_ID}" data-index="1" title="Tap for next image">
                </div>
                
                <div class="desktop-stats">
                    <div class="desktop-stats-container">
                        ${statsHtml}
                    </div>
                </div>
            </div>

            <div class="modal-right-col">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <button id="btn-map" class="btn secondary-btn pill-btn" style="padding: 2px 8px; font-size: 0.75rem; width: auto; flex-shrink: 0;">🗺️ Directions</button>
                    <p class="meta-text" style="margin:0;">${venue.Address || ''}</p>
                </div>
                
                <div class="mobile-stats">
                    ${statsHtml}
                </div>
                
                ${ratingsTableHtml}
            </div>
        </div>
        
        <div class="full-width-about" style="background-color: var(--near-black); padding: 20px; border-radius: var(--radius-card); margin-bottom: 15px; margin-top: 15px;">
            <h3 class="display-font" style="color: var(--primary-blue); margin-bottom:10px;">ABOUT</h3>
            <div style="color: #fff; line-height: 1.5;">${formatAboutText(venue.Description)}</div>
        </div>
        
        ${eventsHtml}
    `;

    const img = document.getElementById('modal-venue-image');
    if(img) handleImageCarousel(img);

    const starBtn = document.getElementById('modal-star');
    if(starBtn) {
        const isFav = userFavorites.includes(venue.Venue_ID);
        starBtn.className = `icon-btn fav-btn ${isFav ? 'active-star' : ''}`;
        starBtn.onclick = () => toggleFavorite(venue.Venue_ID, starBtn);
    }

    const shortBtn = document.getElementById('modal-shortlist');
    if(shortBtn) {
        const isShortlisted = Object.values(userShortlists).some(list => list.includes(venue.Venue_ID));
        shortBtn.className = `icon-btn fav-btn ${isShortlisted ? 'active-star' : ''}`;
        shortBtn.innerHTML = '<img src="shortlist.png" style="width:24px;">';
        shortBtn.onclick = () => promptAddToShortlist(venue);
    }
    
    const shareBtn = document.getElementById('modal-share');
    if(shareBtn) {
        shareBtn.innerHTML = '<img src="link.png" style="width:24px;">';
        shareBtn.onclick = () => shareURL(`${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}`, venue.Name);
    }
    
    const mapBtn = document.getElementById('btn-map');
    if(mapBtn) {
        mapBtn.onclick = () => {
            const rawAddress = venue.Address || venue.City || venue.Name || '';
            const queryPlus = encodeURIComponent(rawAddress.trim()).replace(/%20/g, '+');
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                window.open(`http://maps.apple.com/?q=${queryPlus}`, '_blank');
            } else {
                window.open(`https://maps.google.com/?q=${queryPlus}`, '_blank');
            }
        };
    }

    venueModal?.classList.remove('hidden');
}

async function shareURL(url, title) {
    if (navigator.share) {
        try { await navigator.share({title: title, url: url}); } catch (e) {}
    } else {
        navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard!");
    }
}

function shareShortlist(name) {
    const url = `${window.location.origin}${window.location.pathname}#shortlist=${encodeURIComponent(name)}`;
    shareURL(url, `Backroom Shortlist: ${name}`);
}

function saveLocation() {
    recordUserInteraction();
    const cityInp = document.getElementById('loc-city');
    const loc = { 
        country: document.getElementById('loc-country')?.value || '', 
        city: cityInp?.value || '', 
        postcode: document.getElementById('loc-postcode')?.value || '' 
    };
    
    if(loc.city && loc.city !== 'My Location') {
        if(searchInput) searchInput.value = loc.city;
        window.location.hash = '';
        applyFilters();
    }
    
    localStorage.setItem('br_location', JSON.stringify(loc));
    updateLocationDisplay(loc);
    locModal?.classList.add('hidden');
}

function clearLocation() {
    localStorage.removeItem('br_location');
    const cInp = document.getElementById('loc-country');
    const ciInp = document.getElementById('loc-city');
    const pInp = document.getElementById('loc-postcode');
    const lMap = document.getElementById('loc-map');
    const mPlace = document.getElementById('map-preview-placeholder');

    if(cInp) cInp.value = ''; 
    if(ciInp) { ciInp.value = ''; ciInp.dataset.lat = ''; ciInp.dataset.lon = ''; }
    if(pInp) pInp.value = '';
    if(lMap) lMap.style.display = 'none';
    if(mPlace) mPlace.classList.remove('hidden');
    
    updateLocationDisplay(null);
}

function loadSavedLocation() {
    const saved = localStorage.getItem('br_location');
    if(saved) {
        const loc = JSON.parse(saved);
        const cInp = document.getElementById('loc-country');
        const ciInp = document.getElementById('loc-city');
        const pInp = document.getElementById('loc-postcode');
        
        if(cInp) cInp.value = loc.country || ''; 
        if(ciInp) ciInp.value = loc.city || ''; 
        if(pInp) pInp.value = loc.postcode || '';
        updateLocationDisplay(loc);
    }
}

function updateLocationDisplay(loc) {
    const display = document.getElementById('current-location-display');
    if(!display) return;
    if(loc && (loc.city || loc.country)) display.innerText = `Current: ${loc.city ? loc.city : ''} ${loc.country ? loc.country : ''}`; 
    else display.innerText = 'No location set.';
}

document.addEventListener('DOMContentLoaded', initApp);