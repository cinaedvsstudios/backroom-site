// --- Application State ---
let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilter = 'All';
let selectedCardId = null;
let currentTargetVenue = null; 
let currentEventCityFilter = 'All';

let userFavorites = JSON.parse(localStorage.getItem('br_favorites')) || [];
let userShortlists = JSON.parse(localStorage.getItem('br_shortlists')) || {};
let userProfile = JSON.parse(localStorage.getItem('br_profile')) || { name: '', avatar: '' };
let savedProfiles = JSON.parse(localStorage.getItem('br_saved_profiles')) || {};
let userEvents = JSON.parse(localStorage.getItem('br_events')) || [];
let userTravel = JSON.parse(localStorage.getItem('br_travel')) || [];
let importInfo = JSON.parse(localStorage.getItem('br_import_info')) || null;

const APP_VERSION = "v0.22";
const APP_DATE = "May 13, 2026";

const avatarCategories = ["Twink", "Twunk", "Jock", "Muscle", "Geek", "Uncle", "Daddy", "Silver Fox", "Opa", "Bear", "Seal", "Otter", "Cub", "Wolf", "Circuit", "Leather", "Rubber", "Puppy", "Alternative", "Queer", "Femboy", "Slave"];

let leafletMap = null;
let leafletMarker = null;

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
    welcomeScreen.classList.add('hidden');
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    var R = 6371; var dLat = (lat2-lat1) * (Math.PI/180); var dLon = (lon2-lon1) * (Math.PI/180); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

function setupCriticalListeners() {
    const handleEnter = (e) => {
        if(e.cancelable) e.preventDefault();
        localStorage.setItem('br_age_verified', 'true');
        ageGate.classList.add('hidden');
        appShell.classList.remove('hidden');
        handleRouting(); 
    };
    btnEnter.addEventListener('click', handleEnter);
    btnEnter.addEventListener('touchstart', handleEnter, {passive: false});

    if(localStorage.getItem('br_age_verified') === 'true') {
        ageGate.classList.add('hidden');
        appShell.classList.remove('hidden');
    }
}

async function initApp() {
    setupCriticalListeners();
    document.getElementById('sidebar-version-display').innerHTML = `${APP_VERSION}<br>${APP_DATE}`;
    updateProfileDisplay();
    checkImportPreview();

    try {
        const [sysRes, themeRes, venuesRes, eventsRes] = await Promise.all([
            fetch('system_info.json'), fetch('design_theme.json'),
            fetch('listings.json'), fetch('events.json')
        ]);
        
        if(!sysRes.ok || !venuesRes.ok) throw new Error("Core JSON missing");
        
        systemInfo = await sysRes.json();
        designTheme = await themeRes.json();
        venues = await venuesRes.json();
        events = await eventsRes.json();

        applyTheme(); 
        populateSystemText(); 
        setupEventListeners(); 
        loadSavedLocation(); 
        
        if(localStorage.getItem('br_age_verified') === 'true') handleRouting();
        
    } catch (error) {
        console.error("Local JSON fetch failed.", error);
        document.getElementById('error-text').innerText = "Data error: " + error.message + ". Browsers block local file loading. Click bypass below to view UI.";
        errorPanel.classList.remove('hidden');
        
        const bypassContainer = document.getElementById('bypass-container');
        bypassContainer.innerHTML = '';
        const bypassBtn = document.createElement('button');
        bypassBtn.innerText = "Continue Without Data";
        bypassBtn.className = "btn secondary-btn pill-btn display-font";
        
        const bypassLogic = (e) => {
            if(e.cancelable) e.preventDefault();
            errorPanel.classList.add('hidden');
            systemInfo = { labels: { rated_by_gays: "Rated by gays" } };
            designTheme = {}; venues = []; events = [];
            applyTheme(); populateSystemText(); setupEventListeners(); loadSavedLocation(); 
            if(localStorage.getItem('br_age_verified') === 'true') handleRouting();
        };

        bypassBtn.addEventListener('click', bypassLogic);
        bypassBtn.addEventListener('touchstart', bypassLogic, {passive: false});
        bypassContainer.appendChild(bypassBtn);
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
    document.getElementById('ag-text').innerText = systemInfo.age_gate_text || '';
    document.getElementById('ag-disclaimer').innerText = systemInfo.disclaimer_text || '';
}

window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    const hash = window.location.hash;
    const query = searchInput.value.trim();
    
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    contextHeader.classList.add('hidden');
    document.getElementById('event-city-filters').classList.add('hidden');
    document.getElementById('btn-new-shortlist-view').classList.add('hidden');
    document.getElementById('btn-edit-travel-page').classList.add('hidden');
    document.getElementById('main-filters').classList.remove('hidden');
    document.getElementById('discounts-container').classList.add('hidden');
    welcomeScreen.classList.add('hidden');

    const wipeToast = document.getElementById('profile-wipe-toast');
    if (wipeToast) wipeToast.classList.add('hidden');

    if (hash === '' && query === '' && activeFilter === 'All' && sessionStorage.getItem('br_welcome_dismissed') !== 'true') {
        document.getElementById('main-filters').classList.add('hidden');
        resultsContainer.innerHTML = '';
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
}

function renderWelcomeScreen() {
    document.getElementById('welcome-name').innerText = userProfile.name || 'GUEST';
    if(userProfile.avatar) {
        document.getElementById('welcome-avatar').src = `Profile_images/${userProfile.avatar}`;
    }
    welcomeScreen.classList.remove('hidden');
}

function renderDiscountsView() {
    document.getElementById('main-filters').classList.add('hidden');
    resultsContainer.innerHTML = '';
    document.getElementById('discounts-container').classList.remove('hidden');
}

function setupEventListeners() {
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
    });
    
    document.getElementById('close-modal').addEventListener('click', () => {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        handleRouting();
    });

    document.getElementById('btn-location').addEventListener('click', () => {
        if(window.location.hash !== '') window.location.hash = '';
        locModal.classList.remove('hidden');
    });
    
    document.getElementById('btn-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
    document.getElementById('btn-profile-menu').addEventListener('click', openProfileMenu);
    document.getElementById('btn-favorites').addEventListener('click', () => window.location.hash = '#favorites');
    document.getElementById('btn-shortlists-menu').addEventListener('click', () => window.location.hash = '#myshortlists');
    
    document.getElementById('btn-sidebar-travel').addEventListener('click', () => {
        const drop = document.getElementById('travel-dropdown');
        drop.classList.toggle('hidden');
        renderTravelDropdown();
    });

    document.getElementById('btn-language').addEventListener('click', () => alert("Translation widget placeholder"));
    document.getElementById('btn-back-to-results').addEventListener('click', () => {
        searchInput.value = '';
        window.location.hash = '';
    });

    document.getElementById('btn-save-location').addEventListener('click', saveLocation);
    document.getElementById('btn-clear-location').addEventListener('click', clearLocation);
    
    document.getElementById('btn-gps').addEventListener('click', () => {
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
                        cityInput.value = city;
                        document.getElementById('loc-country').value = data.address.country || '';
                    } catch (e) {
                        cityInput.value = `My Location`;
                    }
                    
                    cityInput.dataset.lat = lat;
                    cityInput.dataset.lon = lon;
                    initLeafletMap(lat, lon);
                },
                (err) => { alert("GPS Denied or Unavailable."); }
            );
        } else alert("Geolocation not supported.");
    });

    document.getElementById('btn-search-map').addEventListener('click', async () => {
        const country = document.getElementById('loc-country').value.trim();
        const city = document.getElementById('loc-city').value.trim();
        const pc = document.getElementById('loc-postcode').value.trim();
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

    document.getElementById('btn-save-travel').addEventListener('click', () => {
        const city = document.getElementById('loc-city').value.trim();
        if(city && city !== 'My Location' && !userTravel.includes(city)) {
            userTravel.push(city);
            localStorage.setItem('br_travel', JSON.stringify(userTravel));
            showToast(`Saved to Travel 🚄: ${city}`);
            document.getElementById('loc-city').value = '';
            if(window.location.hash === '#mytravel') renderTravelFullView();
            else renderTravelDropdown();
        }
    });

    document.getElementById('btn-reset-age').addEventListener('click', () => {
        localStorage.removeItem('br_age_verified');
        window.location.reload();
    });
    
    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if(confirm("Delete all favorites, shortlists, events, and settings? This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
    
    document.querySelectorAll('.btn-export-trigger').forEach(btn => btn.addEventListener('click', exportUserData));
    document.getElementById('import-data-file').addEventListener('change', importUserData);

    document.getElementById('btn-add-create-shortlist').addEventListener('click', () => {
        const name = document.getElementById('add-new-shortlist-name').value.trim();
        if(name && currentTargetVenue) { 
            userShortlists[name] = [currentTargetVenue.Venue_ID]; 
            saveUserShortlists(); 
            addShortlistModal.classList.add('hidden');
            showToast(`Added to shortlist: ${name}`);
        }
    });
    
    document.getElementById('btn-save-profile').addEventListener('click', () => {
        userProfile.name = document.getElementById('profile-name').value.trim();
        if(userProfile.name) {
            savedProfiles[userProfile.name] = { ...userProfile };
            localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
        }
        localStorage.setItem('br_profile', JSON.stringify(userProfile));
        profileModal.classList.add('hidden');
        updateProfileDisplay();
        showToast("Profile saved locally!");
        if(window.location.hash === '' && searchInput.value === '') renderWelcomeScreen();
    });

    const btnNewProfile = document.getElementById('btn-new-profile');
    if (btnNewProfile) {
        btnNewProfile.addEventListener('click', () => {
            const wipeToast = document.getElementById('profile-wipe-toast');
            if(wipeToast) wipeToast.classList.remove('hidden');
        });
    }

    const btnWipeAll = document.getElementById('btn-wipe-all');
    if (btnWipeAll) {
        btnWipeAll.addEventListener('click', () => {
            localStorage.clear();
            window.location.reload();
        });
    }

    const btnWipeProfileOnly = document.getElementById('btn-wipe-profile-only');
    if (btnWipeProfileOnly) {
        btnWipeProfileOnly.addEventListener('click', () => {
            userProfile = { name: '', avatar: '' };
            localStorage.setItem('br_profile', JSON.stringify(userProfile));
            document.getElementById('profile-name').value = '';
            renderProfileAvatars();
            updateProfileDisplay();
            const wipeToast = document.getElementById('profile-wipe-toast');
            if(wipeToast) wipeToast.classList.add('hidden');
            showToast("Profile reset. Data kept.");
        });
    }

    document.getElementById('profile-switcher').addEventListener('change', (e) => {
        const pName = e.target.value;
        if(pName && savedProfiles[pName]) {
            userProfile = { ...savedProfiles[pName] };
            document.getElementById('profile-name').value = userProfile.name;
            renderProfileAvatars();
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

    searchInput.addEventListener('input', () => { recordUserInteraction(); window.location.hash=''; handleRouting(); });
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            recordUserInteraction();
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.getAttribute('data-filter');
            window.location.hash=''; 
            handleRouting();
        });
    });
}

function initLeafletMap(lat, lng) {
    document.getElementById('map-preview-placeholder').classList.add('hidden');
    const mapDiv = document.getElementById('loc-map');
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
    const topAvatar = document.getElementById('top-profile-avatar');
    const topName = document.getElementById('top-profile-name');
    if(userProfile.name) topName.innerText = userProfile.name;
    else topName.innerText = '👤';

    if(userProfile.avatar) {
        topAvatar.src = `Profile_images/${userProfile.avatar}`;
        topAvatar.style.display = 'inline-block';
        if(!userProfile.name) topName.style.display = 'none'; 
    } else {
        topAvatar.style.display = 'none';
        topName.style.display = 'inline-block';
    }
}

function renderTravelDropdown() {
    const list = document.getElementById('travel-cities-list');
    list.classList.remove('hidden');
    list.innerHTML = '';
    userTravel.forEach(city => {
        const item = document.createElement('div');
        item.className = 'submenu-item';
        item.innerHTML = `<span style="flex-grow:1;" onclick="document.getElementById('search-input').value='${city}'; handleRouting();">${city}</span>`;
        list.appendChild(item);
    });
}

window.removeTravel = function(city) {
    userTravel = userTravel.filter(c => c !== city);
    localStorage.setItem('br_travel', JSON.stringify(userTravel));
    if(window.location.hash === '#mytravel') renderTravelFullView();
    else renderTravelDropdown();
}

function applyFilters() {
    const query = searchInput.value;
    let filteredVenues = venues || [];
    selectedCardId = null;

    if(activeFilter !== 'All') {
        filteredVenues = filteredVenues.filter(v => {
            if(activeFilter === 'Darkroom') return v.Feature_Darkroom;
            if(activeFilter === 'Men Only') return v.Feature_Men_Only;
            if(activeFilter === 'Open Now') return v.Status === 'Live';
            return true;
        });
    }

    if(query.trim() !== '') {
        filteredVenues = filteredVenues.filter(v => fuzzyMatch(v.Name + " " + v.Description + " " + v.Vibe_Tags + " " + v.City, query));
    }

    renderListings(filteredVenues);
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

function saveUserFavorites() { localStorage.setItem('br_favorites', JSON.stringify(userFavorites)); }
function saveUserShortlists() { localStorage.setItem('br_shortlists', JSON.stringify(userShortlists)); }
function saveUserEvents() { localStorage.setItem('br_events', JSON.stringify(userEvents)); }

function toggleFavorite(id, btnElement) {
    const index = userFavorites.indexOf(id);
    if(index > -1) {
        userFavorites.splice(index, 1);
        btnElement.classList.remove('active-star');
    } else {
        userFavorites.push(id);
        btnElement.classList.add('active-star');
        showToast("Saved to Favourite Venues ⚜️");
    }
    saveUserFavorites();
    if(window.location.hash === '#favorites') renderFavoritesView();
}

window.toggleEventFavorite = function(eventId, btnElement, isRemovalView = false) {
    const index = userEvents.indexOf(eventId);
    if(index > -1) {
        if(isRemovalView && !confirm("Remove this event from your list?")) return;
        userEvents.splice(index, 1);
        if(btnElement) btnElement.classList.remove('active-star');
    } else {
        userEvents.push(eventId);
        if(btnElement) btnElement.classList.add('active-star');
        showToast("Saved to 💖 Events");
    }
    saveUserEvents();
    if(window.location.hash === '#myevents') renderMyEventsView();
}

function renderFavoritesView() {
    document.getElementById('main-filters').classList.add('hidden');
    contextHeader.classList.remove('hidden');
    document.getElementById('context-title').innerHTML = "⚜️ MY FAVOURITES";
    document.getElementById('context-desc').innerText = "Venues you have starred locally.";
    
    const favVenues = (venues||[]).filter(v => userFavorites.includes(v.Venue_ID));
    renderListings(favVenues, true);
}

function renderMyEventsView() {
    document.getElementById('main-filters').classList.add('hidden');
    contextHeader.classList.remove('hidden');
    document.getElementById('context-title').innerHTML = "💖 MY EVENTS";
    document.getElementById('context-desc').innerText = "Events you have pinned locally.";
    
    const cityFilterContainer = document.getElementById('event-city-filters');
    cityFilterContainer.classList.remove('hidden');
    cityFilterContainer.innerHTML = '';
    
    let myEvts = (events||[]).filter(e => userEvents.includes(e.Event_ID));
    
    if(myEvts.length === 0) {
        resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No saved events.</p>`;
        cityFilterContainer.classList.add('hidden');
        return;
    }

    const cities = new Set();
    myEvts.forEach(ev => {
        const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
        if(venue && venue.City) cities.add(venue.City);
    });

    const createCityBtn = (cityName, label) => {
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

    resultsContainer.innerHTML = '';
    myEvts.forEach(ev => {
        const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
        const venueName = venue ? venue.Name : 'Unknown Venue';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${ev.Event_Name}</h3><div class="card-meta">${formatDateToDDMMYYYY(ev.Event_Date)} | @ ${venueName}</div></div>
                    <button class="icon-btn" style="color:var(--bright-red-orange); font-size:1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', null, true)">❌</button>
                </div>
                <div class="card-about">${ev.Event_Description || ''}</div>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

function renderTravelFullView() {
    document.getElementById('main-filters').classList.add('hidden');
    contextHeader.classList.remove('hidden');
    document.getElementById('context-title').innerHTML = "🚄 MY TRAVEL PINS";
    document.getElementById('context-desc').innerText = "Cities you plan to visit.";
    document.getElementById('btn-edit-travel-page').classList.remove('hidden');
    
    resultsContainer.innerHTML = '';

    if(userTravel.length === 0) {
        resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No travel pins saved yet.</p>`;
        return;
    }

    userTravel.forEach(city => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div onclick="document.getElementById('search-input').value='${city}'; window.location.hash=''; handleRouting();" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${city}</h3>
                </div>
                <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete ${city}?')){ removeTravel('${city}'); }">❌</button>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

function renderShortlistsFullView() {
    document.getElementById('main-filters').classList.add('hidden');
    contextHeader.classList.remove('hidden');
    document.getElementById('context-title').innerHTML = "📑 MY SHORTLISTS";
    document.getElementById('context-desc').innerText = "Your named venue collections.";
    
    const newBtn = document.getElementById('btn-new-shortlist-view');
    newBtn.classList.remove('hidden');
    newBtn.onclick = () => {
        const name = prompt("Enter new shortlist name:");
        if(name && name.trim() !== '') {
            userShortlists[name.trim()] = [];
            saveUserShortlists();
            renderShortlistsFullView();
        }
    };

    resultsContainer.innerHTML = '';
    const lists = Object.keys(userShortlists);

    if(lists.length === 0) {
        resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No shortlists created yet.</p>`;
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
                    <button class="icon-btn" onclick="shareShortlist('${name}')" title="Share">🔗</button>
                    <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete shortlist ${name}?')){ delete userShortlists['${name}']; saveUserShortlists(); renderShortlistsFullView(); }">❌</button>
                </div>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

function renderSingleShortlist(listName) {
    if(!userShortlists[listName]) { window.location.hash=''; return; }
    document.getElementById('main-filters').classList.add('hidden');
    contextHeader.classList.remove('hidden');
    document.getElementById('context-title').innerText = listName.toUpperCase();
    document.getElementById('context-desc').innerText = "Saved Shortlist";
    
    const ids = userShortlists[listName];
    const shortVenues = (venues||[]).filter(v => ids.includes(v.Venue_ID));
    renderListings(shortVenues, true);
}

function renderProfileAvatars() {
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = '';
    
    const switcher = document.getElementById('profile-switcher');
    if (switcher) {
        switcher.innerHTML = '<option value="">Switch Profile...</option>';
        Object.keys(savedProfiles).forEach(pName => {
            switcher.innerHTML += `<option value="${pName}">${pName}</option>`;
        });
    }

    avatarCategories.forEach(cat => {
        const imgName = `${cat.toLowerCase()}01.png`; 
        const item = document.createElement('div');
        item.className = 'avatar-item';
        if(userProfile.avatar === imgName) item.classList.add('selected');
        
        item.innerHTML = `<img src="Profile_images/${imgName}" onerror="this.src='placeholder_venue.jpg'" alt="${cat}"><span>${cat}</span>`;
        item.addEventListener('click', () => {
            if (item.classList.contains('selected')) {
                // Deselect and show all
                document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected', 'hidden'));
                userProfile.avatar = '';
            } else {
                // Select and hide others
                document.querySelectorAll('.avatar-item').forEach(el => {
                    el.classList.remove('selected');
                    if (el !== item) el.classList.add('hidden');
                });
                item.classList.add('selected');
                userProfile.avatar = imgName;
                showToast("Click the avatar again to go back to the list");
            }
        });
        grid.appendChild(item);
    });
}

function openProfileMenu() {
    document.getElementById('profile-name').value = userProfile.name || '';
    renderProfileAvatars();
    profileModal.classList.remove('hidden');
}

function promptAddToShortlist(venue) {
    currentTargetVenue = venue;
    document.getElementById('add-shortlist-target-name').innerText = venue.Name;
    const container = document.getElementById('add-shortlist-options');
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
                saveUserShortlists();
                addShortlistModal.classList.add('hidden');
                showToast(isAdded ? "Removed from Shortlist" : "Added to Shortlist");
            });
            container.appendChild(btn);
        });
    }
    addShortlistModal.classList.remove('hidden');
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
    resultsContainer.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);

    if(!data || data.length === 0) {
        let emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No venues found.</p>`;
        
        const cityInput = document.getElementById('loc-city');
        const userLat = parseFloat(cityInput.dataset.lat);
        const userLon = parseFloat(cityInput.dataset.lon);
        
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
                    No venues found here.<br><br>
                    <a href="javascript:void(0)" onclick="document.getElementById('search-input').value='${nearest.City}'; applyFilters();" style="color:var(--primary-blue); font-weight:bold; font-size:1.1rem; text-decoration:underline;">
                        Closest venue is ${distRounded} km away in ${nearest.City}.<br>Click here to load ${nearest.City}.
                    </a>
                </p>`;
            }
        }
        resultsContainer.innerHTML = emptyHtml;
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
                    <div><h3 class="card-title display-font">${venue.Name}</h3><div class="card-meta">${venue.Category} • ${venue.City}</div></div>
                    <div class="status-badge ${venue.Status.toLowerCase()}">${venue.Status.toUpperCase()}</div>
                </div>
                <div class="card-about">${shortDesc}</div>
                ${nextEventHtml}
                <div class="card-stats">
                    <span>🌈 ${systemInfo.labels?.rated_by_gays || 'Rated by gays'}</span><span>👁️ ${venue.Views || 0}</span>
                    <span class="star-btn icon-btn ${isFav ? 'active-star' : ''}" style="margin-left:auto; font-size:1.8rem; line-height:1;">⚜️</span>
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
        resultsContainer.appendChild(card);
    });
}

function openVenueModal(venue) {
    document.getElementById('modal-title').innerText = venue.Name;
    
    // Dynamic Layout build for Desktop Split
    const dynamicLayout = document.getElementById('modal-dynamic-layout');
    
    const ageEmojis = ['🧒🏼', '🧑🏻', '🧔🏻‍♂️', '👨🏻‍🦳', '👴🏼'];
    const sizeEmojis = ['🤏', '👍', '✌️', '🖐️', '🤲'];
    const popEmojis = ['💀', '🍹', '🕺', '👯‍♀️', '🎉'];
    
    const ageScale = ageEmojis.slice(0, venue.Rating_Age_Range || 0).join('');
    const sizeScale = sizeEmojis.slice(0, venue.Rating_Size || 0).join('');
    const popScale = popEmojis.slice(0, venue.Rating_Busyness || 0).join('');

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
        <div class="feature-chips">${featureHtml}</div>
    `;
    
    const ratingsHtml = `
        <div class="ratings-grid" id="modal-ratings">
            <div class="rating-item"><span>General</span><span>${'🍆'.repeat(venue.Rating_General || 0)}</span></div>
            <div class="rating-item"><span>Darkroom</span><span>${'💦'.repeat(venue.Rating_Darkroom || 0)}</span></div>
            <div class="rating-item"><span>Cost</span><span>${'💰'.repeat(venue.Rating_Cost || 0)}</span></div>
            <div class="rating-item"><span>Location</span><span>${'🍑'.repeat(venue.Rating_Location || 0)}</span></div>
            <div class="rating-item"><span>Popularity</span><span>${popScale}</span></div>
            <div class="rating-item"><span>Age Range</span><span>${ageScale}</span></div>
            <div class="rating-item"><span>Size</span><span>${sizeScale}</span></div>
        </div>
    `;

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
                                <button class="icon-btn ${isSaved ? 'active-star' : ''}" style="font-size: 1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', this)">💖</button>
                            </div>
                            <p style="font-size:0.9rem; margin-top:5px;">${ev.Event_Description}</p>
                        </div>
                    </div>
                </div>`;
        });
        eventsHtml += `</div>`;
    }

    dynamicLayout.innerHTML = `
        <div class="modal-left-col">
            <div class="modal-image-container">
                <img id="modal-venue-image" class="venue-image centered-image" src="Venue_images/${venue.Venue_ID}-01.jpg" onerror="this.src='placeholder_venue.jpg'" data-id="${venue.Venue_ID}" data-index="1" title="Tap for next image">
            </div>
            
            <div class="desktop-stats">
                <div class="desktop-stats-container">
                    ${statsHtml}
                    <hr style="border: 0; height: 2px; background: var(--bright-red-orange); margin: 15px 0;">
                    <h3 class="display-font" style="color: var(--primary-blue); margin-bottom:10px;">ABOUT</h3>
                    <p style="color: #fff; line-height: 1.5;">${venue.Description}</p>
                </div>
                ${eventsHtml}
            </div>
        </div>

        <div class="modal-right-col">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <button id="btn-map" class="btn secondary-btn pill-btn" style="padding: 2px 8px; font-size: 0.75rem; width: auto; flex-shrink: 0;">🗺️ Directions</button>
                <p class="meta-text" style="margin:0;">${venue.Address}</p>
            </div>
            
            <div class="mobile-stats">
                ${statsHtml}
            </div>
            
            ${ratingsHtml}

            <div class="mobile-stats">
                <div class="description-block">
                    <h3 class="display-font">ABOUT</h3>
                    <p>${venue.Description}</p>
                </div>
                ${eventsHtml}
            </div>
        </div>
    `;

    const img = document.getElementById('modal-venue-image');
    handleImageCarousel(img);

    const starBtn = document.getElementById('modal-star');
    const isFav = userFavorites.includes(venue.Venue_ID);
    starBtn.className = `icon-btn ${isFav ? 'active-star' : ''}`;
    starBtn.onclick = () => toggleFavorite(venue.Venue_ID, starBtn);

    document.getElementById('modal-shortlist').onclick = () => promptAddToShortlist(venue);
    document.getElementById('modal-share').onclick = () => shareURL(`${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}`, venue.Name);
    
    document.getElementById('btn-map').onclick = () => {
        const query = encodeURIComponent(venue.Address || venue.City || venue.Name);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            window.open(`http://maps.apple.com/?q=${query}`, '_blank');
        } else {
            window.open(`http://googleusercontent.com/maps.google.com/maps?q=${query}`, '_blank');
        }
    };

    venueModal.classList.remove('hidden');
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
        country: document.getElementById('loc-country').value, 
        city: cityInp.value, 
        postcode: document.getElementById('loc-postcode').value 
    };
    
    if(loc.city && loc.city !== 'My Location') {
        searchInput.value = loc.city;
        window.location.hash = '';
        applyFilters();
    }
    
    localStorage.setItem('br_location', JSON.stringify(loc));
    updateLocationDisplay(loc);
    locModal.classList.add('hidden');
}

function clearLocation() {
    localStorage.removeItem('br_location');
    document.getElementById('loc-country').value = ''; 
    document.getElementById('loc-city').value = ''; 
    document.getElementById('loc-city').dataset.lat = '';
    document.getElementById('loc-city').dataset.lon = '';
    document.getElementById('loc-postcode').value = '';
    document.getElementById('loc-map').style.display = 'none';
    document.getElementById('map-preview-placeholder').classList.remove('hidden');
    updateLocationDisplay(null);
}

function loadSavedLocation() {
    const saved = localStorage.getItem('br_location');
    if(saved) {
        const loc = JSON.parse(saved);
        document.getElementById('loc-country').value = loc.country || ''; 
        document.getElementById('loc-city').value = loc.city || ''; 
        document.getElementById('loc-postcode').value = loc.postcode || '';
        updateLocationDisplay(loc);
    }
}

function updateLocationDisplay(loc) {
    const display = document.getElementById('current-location-display');
    if(loc && (loc.city || loc.country)) display.innerText = `Current: ${loc.city ? loc.city : ''} ${loc.country ? loc.country : ''}`; 
    else display.innerText = 'No location set.';
}

document.addEventListener('DOMContentLoaded', initApp);