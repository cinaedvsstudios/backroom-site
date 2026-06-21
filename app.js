// --- Application State ---
const APP_VERSION = "v0.67";
const APP_DATE = "21 June 2026";

let systemInfo = {}, designTheme = {}, venues = [], events = [];
let activeFilters = []; // v0.66 Multi-select Array
let selectedCardId = null;
let venueReturnHash = '#results';
let currentTargetVenue = null; 
let currentEventCityFilter = 'All';
let isTutorialRunning = false; 

// Profile Data Structure (Save Game Style)
let userProfile = JSON.parse(localStorage.getItem('br_profile')) || { name: '', avatar: '' };
let savedProfiles = JSON.parse(localStorage.getItem('br_saved_profiles')) || {};

// Globals swapped per profile
let userFavorites = [];
let userShortlists = {};
let userShortlistEmojis = {}; 
let userEvents = [];
let userTravel = [];

let importInfo = JSON.parse(localStorage.getItem('br_import_info')) || null;
let avatarData = [];
let activeAvatarCategories = [];
let profileOpenName = '';
let profileOpenAvatar = '';

let leafletMap = null;
let leafletMarker = null;

const ageGate = document.getElementById('age-gate');
const appShell = document.getElementById('app-shell');
const errorPanel = document.getElementById('error-panel');
const btnEnter = document.getElementById('btn-enter');
const resultsContainer = document.getElementById('results-container');
const searchInput = document.getElementById('search-input');
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

const MASTER_VIBE_TAGS = ["Bar","Party","Cinema","Sauna","Shop","Cruising","Darkroom","Men Only","Dresscode","Naked","Underwear","Dancefloor","Smoking Area","Cocktails","Fetish/Gear","Bear","Mature","Young Crowd","Queer","Drag","Karaoke","Pop/Dance","Techno"];
const SHORTLIST_EMOJIS = ['🤠','🚄','👑','🥂','🦄','🫦','💪','🪇','🔥','🍆','🍑','💄','🛁','✈️','💥','💦','🗝️','🧿','🎧','🧭','⛓️','🎼'];
const PLACEHOLDER_POOL = ['placeholder_venue.jpg', 'placeholder_venue01.jpg', 'placeholder_venue02.jpg', 'placeholder_venue03.jpg', 'placeholder_venue04.jpg', 'placeholder_venue05.jpg', 'placeholder_venue06.jpg', 'placeholder_venue07.jpg'];
const BR_ICONS = { share: '📣', favourite: '⚜️', savedEvent: '💖', report: 'report.png', link: 'link.png', shortlist: 'shortlist.png' };
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.cloud/f/ae0e141d-ad94-47fe-ac46-55702c6534a6/';

function getTagColorClass(tag) {
    const red = ['Cruising', 'Darkroom', 'Men Only', 'Dresscode', 'Naked', 'Underwear', 'Smoking Area', 'Fetish/Gear'];
    const blue = ['Bar', 'Party', 'Cinema', 'Sauna', 'Shop', 'Dancefloor', 'Cocktails', 'Techno', 'Pop/Dance'];
    const yellow = ['Bear', 'Mature', 'Young Crowd', 'Queer', 'Drag', 'Karaoke'];
    if (red.includes(tag)) return 'tag-adult-red';
    if (blue.includes(tag)) return 'tag-venue-blue';
    if (yellow.includes(tag)) return 'tag-social-yellow';
    return 'tag-venue-blue';
}

function getVenueTags(venue) {
    if (!venue || !venue.Vibe_Tags) return [];
    const seen = new Set();
    return String(venue.Vibe_Tags)
        .split(',')
        .map(t => t.trim())
        .filter(t => {
            if (!t || seen.has(t)) return false;
            seen.add(t);
            return MASTER_VIBE_TAGS.includes(t);
        });
}


function getCityTokens(venue) {
    return String(venue?.City || '')
        .split(',')
        .map(city => city.trim())
        .filter(Boolean);
}

function isMultiCityVenue(venue) {
    return getCityTokens(venue).length > 1;
}

function formatVenueLocation(venue) {
    const cityText = getCityTokens(venue).join(', ');
    const countryText = String(venue?.Country || '').trim();
    if (cityText && countryText) return `${cityText} · ${countryText}`;
    return cityText || countryText || '';
}

function venueMatchesCity(venue, cityName) {
    const target = String(cityName || '').trim().toLowerCase();
    if (!target) return true;
    return getCityTokens(venue).some(city => city.toLowerCase() === target);
}

function hasFixedCoordinates(venue) {
    if (isMultiCityVenue(venue)) return false;
    const lat = parseFloat(venue?.Latitude);
    const lon = parseFloat(venue?.Longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon);
}

function renderTagPills(tags, extraStyle = '') {
    return (tags || []).map(tag => `<span class="chip pill-btn ${getTagColorClass(tag)}" title="${tag}" style="font-size:0.85rem; padding: 4px 10px; ${extraStyle}">${tag}</span>`).join('');
}


function normalizeFeaturedLevel(venue) {
    return String(venue?.Priority || '').trim();
}

function getVenueSearchText(venue) {
    const cityTokens = getCityTokens(venue).join(' ');
    return [
        venue?.Name,
        venue?.Description,
        venue?.Opening_Notes,
        venue?.Vibe_Tags,
        venue?.City,
        cityTokens,
        venue?.Country,
        venue?.Address,
        venue?.Postcode,
        venue?.Nearest_Station,
        venue?.Native_Map_Query,
        venue?.Website_URL,
        venue?.Instagram_URL,
        venue?.Facebook_URL,
        venue?.Other_URL,
        venue?.Source_URLs
    ].filter(Boolean).join(' ');
}

function getPublicVenues(source = venues) {
    return (source || []).filter(v => {
        const status = String(v?.Status || '').trim();
        return status !== 'Hold' && status !== 'Flag';
    });
}

function getCardStatusLabel(venue) {
    const status = String(venue?.Status || '').trim();
    if (status === 'Closed') return 'CLOSED';
    if (activeFilters && activeFilters.length > 0) return activeFilters.slice(0, 3).join(' / ');
    return 'ALL';
}

function getCardStatusClass(venue) {
    const status = String(venue?.Status || '').trim().toLowerCase();
    if (status === 'closed') return 'closed';
    return 'all';
}

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

// --- Weekly event recurrence: one JSON record, dynamically dated on the public site ---
const WEEKDAY_INDEX = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6
};
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseEventDateLocal(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if(date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function formatEventDateYmd(date) {
    if(!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStartOfEventDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function getEventStartMinutes(timeValue) {
    const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!match) return null;
    const hours = Number(match[1]), minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : null;
}

function isWeeklyRecurringEvent(event) {
    return String(event?.Recurrence_Type || '').trim().toLowerCase() === 'weekly';
}

function getWeeklyDayIndex(event) {
    const key = String(event?.Recurrence_Day || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, key) ? WEEKDAY_INDEX[key] : null;
}

function getWeeklyRecurrenceLabel(event) {
    const weekday = getWeeklyDayIndex(event);
    return weekday === null ? 'Every week' : `Every ${WEEKDAY_LABELS[weekday]}`;
}

function getNextWeeklyOccurrenceDate(event, now = new Date()) {
    const weekday = getWeeklyDayIndex(event);
    if(!isWeeklyRecurringEvent(event) || weekday === null) return null;

    const today = getStartOfEventDay(now);
    const firstDate = parseEventDateLocal(event.Event_Date);
    const untilDate = parseEventDateLocal(event.Recurrence_Until);
    const earliest = firstDate && firstDate > today ? firstDate : today;
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + ((weekday - candidate.getDay() + 7) % 7));

    if(candidate.getTime() === today.getTime()) {
        const startMinutes = getEventStartMinutes(event.Event_Start_Time);
        if(startMinutes !== null) {
            const start = new Date(candidate);
            start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            if(now > start) candidate.setDate(candidate.getDate() + 7);
        }
    }
    while(firstDate && candidate < firstDate) candidate.setDate(candidate.getDate() + 7);
    return untilDate && candidate > untilDate ? null : candidate;
}

function getEventDisplayOccurrence(event, now = new Date()) {
    if(!event) return null;
    if(isWeeklyRecurringEvent(event)) {
        const nextDate = getNextWeeklyOccurrenceDate(event, now);
        if(!nextDate) return null;
        return { ...event, Display_Date: formatEventDateYmd(nextDate), Is_Recurring: true, Recurrence_Label: getWeeklyRecurrenceLabel(event), Is_Past: false };
    }
    const displayDate = String(event.Event_Date || '').trim();
    const eventDate = parseEventDateLocal(displayDate);
    return { ...event, Display_Date: displayDate, Is_Recurring: false, Recurrence_Label: '', Is_Past: Boolean(eventDate && eventDate < getStartOfEventDay(now)) };
}

function getEventDisplayDate(event) {
    return event?.Display_Date || event?.Event_Date || '';
}

function getEventDisplayMeta(event) {
    const pieces = [];
    const date = getEventDisplayDate(event);
    if(date) pieces.push(formatDateToDDMMYYYY(date));
    if(event?.Event_Start_Time) pieces.push(event.Event_Start_Time);
    if(event?.Is_Recurring && event.Recurrence_Label) pieces.push(event.Recurrence_Label);
    return pieces.join(' | ');
}

function compareEventOccurrences(a, b) {
    if(Boolean(a?.Is_Past) !== Boolean(b?.Is_Past)) return a.Is_Past ? 1 : -1;
    const dateA = parseEventDateLocal(getEventDisplayDate(a)) || new Date(8640000000000000);
    const dateB = parseEventDateLocal(getEventDisplayDate(b)) || new Date(8640000000000000);
    if(dateA.getTime() !== dateB.getTime()) return dateA - dateB;
    const timeA = getEventStartMinutes(a?.Event_Start_Time), timeB = getEventStartMinutes(b?.Event_Start_Time);
    if(timeA !== timeB) return (timeA ?? 1440) - (timeB ?? 1440);
    return String(a?.Event_Name || '').localeCompare(String(b?.Event_Name || ''));
}

function getVenueEventOccurrences(venueId, options = {}) {
    const { includePast = true, activeOnly = false, now = new Date() } = options;
    return (events || [])
        .filter(event => event?.Venue_ID === venueId)
        .filter(event => !activeOnly || !['Hold', 'Flag'].includes(String(event?.Status || '').trim()))
        .map(event => getEventDisplayOccurrence(event, now))
        .filter(Boolean)
        .filter(event => includePast || !event.Is_Past)
        .sort(compareEventOccurrences);
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

function buildSocialBar(venue) {
    let html = '<div class="social-bar" style="display:flex; gap:16px; margin-top:10px; align-items:center;">';
    const buildIcon = (url, iconName, platformName) => {
        const hasUrl = url && url.trim() !== '';
        const opacity = hasUrl ? '1' : '0.6';
        const cursor = hasUrl ? 'pointer' : 'default';
        const clickAction = hasUrl ? `onclick="window.open('${url}', '_blank')"` : '';
        const titleText = hasUrl ? `Open ${platformName}` : `This link is not available`;
        return `<img src="Emoji/${iconName}" title="${titleText}" style="width:24px; height:24px; opacity:${opacity}; cursor:${cursor}; transition: opacity 0.2s;" ${clickAction} alt="${iconName}">`;
    };
    html += buildIcon(venue.Instagram_URL, 'instagram_url.png', 'Instagram');
    html += buildIcon(venue.Facebook_URL, 'facebook_url.png', 'Facebook');
    html += buildIcon(venue.Website_URL, 'website_url.png', 'Website');
    html += buildIcon(venue.Emoji_Override, 'xicon.png', 'X (Twitter)'); 
    html += buildIcon(venue.Other_URL, 'link.png', 'Link');
    html += '</div>';
    return html;
}

function loadActiveProfileData() {
    if (userProfile.name && savedProfiles[userProfile.name]) {
        const bundle = savedProfiles[userProfile.name];
        userFavorites = bundle.favorites || [];
        userShortlists = bundle.shortlists || {};
        userShortlistEmojis = bundle.shortlistEmojis || {};
        userEvents = bundle.events || [];
        userTravel = bundle.travel || [];
    } else {
        userFavorites = JSON.parse(localStorage.getItem('br_favorites')) || [];
        userShortlists = JSON.parse(localStorage.getItem('br_shortlists')) || {};
        userShortlistEmojis = JSON.parse(localStorage.getItem('br_shortlist_emojis')) || {};
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
            shortlistEmojis: userShortlistEmojis,
            events: userEvents,
            travel: userTravel
        };
        localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
    }
    localStorage.setItem('br_favorites', JSON.stringify(userFavorites));
    localStorage.setItem('br_shortlists', JSON.stringify(userShortlists));
    localStorage.setItem('br_shortlist_emojis', JSON.stringify(userShortlistEmojis));
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
        updateMobileTopBarOffset();
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

    if(!document.body.dataset.escapeVenueBound) {
        document.body.dataset.escapeVenueBound = 'true';
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape' && venueModal && !venueModal.classList.contains('hidden')) {
                closeVenueModalToPreviousView();
            }
        });
    }
    if(!window.brMobileTopBarResizeBound) {
        window.brMobileTopBarResizeBound = true;
        window.addEventListener('resize', updateMobileTopBarOffset);
        window.addEventListener('orientationchange', () => setTimeout(updateMobileTopBarOffset, 250));
    }
}

async function initApp() {
    loadActiveProfileData(); 
    setupCriticalListeners();
    updateMobileTopBarOffset();
    const verDisplay = document.getElementById('sidebar-version-display');
    if(verDisplay) verDisplay.innerHTML = `${APP_VERSION}<br>${APP_DATE}`;
    
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

        updateProfileDisplay(); // Moved here so avatarData is loaded
        checkImportPreview();
        applyTheme(); 
        populateSystemText(); 
        setupEventListeners(); 
        loadSavedLocation();
        updateMobileTopBarOffset(); 
        
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
                    Status: "Live", 
                    Description: "If you see this on GitHub, it means listings.json failed to load.",
                    Vibe_Tags: "Dancefloor, Darkroom", 
                    Views: 420,
                    Rating_Age_Range: 3,
                    Rating_Size: 4,
                    Rating_Busyness: 5
                }]; 
                if(!events) events = [];
                
                applyTheme(); populateSystemText(); setupEventListeners(); loadSavedLocation(); updateMobileTopBarOffset(); 
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
window.addEventListener('resize', updateMobileSidebarOffset);


function getCurrentListHashForVenueReturn() {
    const hash = window.location.hash || '#results';
    const listRoutes = ['#results', '#featured', '#favorites', '#myshortlists', '#myevents', '#mytravel', '#discounts', '#about', '#cruising-guide'];
    if (listRoutes.includes(hash)) return hash;
    if (hash.startsWith('#shortlist=')) return '#myshortlists';
    return '#results';
}

function closeVenueModalToPreviousView() {
    venueModal?.classList.add('hidden');
    const target = venueReturnHash || '#results';
    if (window.location.hash === target) handleRouting();
    else window.location.hash = target;
}

function getFeaturedSortScore(venue) {
    const general = Number.parseInt(venue?.Rating_General, 10) || 0;
    const popularity = Number.parseInt(venue?.Rating_Busyness || venue?.Rating_Popularity, 10) || 0;
    const darkroom = Number.parseInt(venue?.Rating_Darkroom, 10) || 0;
    const location = Number.parseInt(venue?.Rating_Location, 10) || 0;
    return (general * 1000) + (popularity * 100) + (darkroom * 10) + location;
}

function sortFeaturedVenues(list) {
    return [...(list || [])].sort((a, b) => {
        const scoreDiff = getFeaturedSortScore(b) - getFeaturedSortScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return String(a?.Name || '').localeCompare(String(b?.Name || ''));
    });
}

function updateMobileTopBarOffset() {
    const topBar = document.getElementById('top-bar');
    if (!topBar) return;
    const height = Math.ceil(topBar.getBoundingClientRect().height || 126);
    const offset = `${height}px`;
    document.documentElement.style.setProperty('--mobile-topbar-height', offset);
    document.documentElement.style.setProperty('--mobile-sidebar-top', offset);
}

function updateMobileSidebarOffset() {
    updateMobileTopBarOffset();
}

function closeSidebarImmediately() {
    if (!sidebar) return;
    sidebar.classList.remove('visible', 'sidebar-opening');
    clearTimeout(sidebarTimeout);
}

function openSidebarTemporarily() {
    if (!sidebar) return;
    updateMobileSidebarOffset();
    sidebar.classList.add('visible', 'sidebar-opening');
    sidebar.scrollTop = 0;
    window.clearTimeout(sidebar.dataset.openingTimer);
    sidebar.dataset.openingTimer = window.setTimeout(() => sidebar.classList.remove('sidebar-opening'), 340);
    clearTimeout(sidebarTimeout);
    sidebarTimeout = setTimeout(closeSidebarImmediately, 5000);
}

function checkSharedListRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#sharedlist?')) {
        const urlParams = new URLSearchParams(hash.substring(12));
        const listName = urlParams.get('title') || 'Shared List';
        const listEmoji = urlParams.get('emoji') || '🔥';
        const venueIds = (urlParams.get('ids') || '').split(',').filter(id => id);

        renderSharedListView(listName, listEmoji, venueIds);
        return true; 
    }
    return false;
}

function renderSharedListView(name, emoji, ids) {
    const searchInputEl = document.getElementById('search-input');
    if(searchInputEl) searchInputEl.style.display = 'none';
    const mainFilters = document.getElementById('main-filters');
    if(mainFilters) mainFilters.style.display = 'none';
    contextHeader?.classList.add('hidden');
    
    if(!resultsContainer) return;
    resultsContainer.innerHTML = '';
    
    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'shared-list-header';
    sharedHeader.style.cssText = 'text-align: center; padding: 30px 15px; margin-bottom: 20px; grid-column: 1 / -1;';
    sharedHeader.innerHTML = `
        <h1 style="font-size: 3rem; margin-bottom: 10px; color: #fff;">${emoji} ${name}</h1>
        <p style="color: var(--text-light); margin-bottom: 20px;">Someone shared this Backroom list with you!</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button id="btn-save-shared" class="btn primary-btn pill-btn" style="padding: 10px 20px;">💾 Save List to Profile</button>
            <button id="btn-open-site" class="btn secondary-btn pill-btn" style="padding: 10px 20px;">🌍 Open Main Site</button>
        </div>
        <p style="font-size: 0.85rem; color: var(--label-grey); margin-top: 15px;">Saving will add this to your shortlists.</p>
    `;
    
    resultsContainer.appendChild(sharedHeader);

    const matchingVenues = venues.filter(v => ids.includes(v.Venue_ID));
    if (matchingVenues.length === 0) {
        resultsContainer.innerHTML += `<p style="text-align:center; color: var(--label-grey); grid-column: 1 / -1;">No active venues found in this list.</p>`;
    } else {
        const tempContainer = document.createElement('div');
        const backupContainerHTML = resultsContainer.innerHTML;
        resultsContainer.innerHTML = '';
        renderListings(matchingVenues, true);
        const renderedCards = resultsContainer.innerHTML;
        resultsContainer.innerHTML = backupContainerHTML + renderedCards;
    }

    document.getElementById('btn-save-shared').addEventListener('click', () => {
        if (!userProfile.name) {
            userProfile.name = 'New Profile';
            userProfile.avatar = avatarData[0]?.file || 'noavatar01.png';
            localStorage.setItem('br_profile', JSON.stringify(userProfile));
        }
        userShortlists[name] = ids;
        userShortlistEmojis[name] = emoji;
        saveCurrentToBundle();
        showToast("List saved to your Shortlists!");
    });

    document.getElementById('btn-open-site').addEventListener('click', () => {
        const searchInputEl = document.getElementById('search-input');
        if(searchInputEl) searchInputEl.style.display = '';
        const mainFilters = document.getElementById('main-filters');
        if(mainFilters) mainFilters.style.display = '';
        window.location.hash = '';
        window.location.reload(); 
    });
}

function handleRouting() {
    if (checkSharedListRoute()) return; 

    const hash = window.location.hash;

    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    contextHeader?.classList.add('hidden');
    document.getElementById('event-city-filters')?.classList.add('hidden');
    document.getElementById('btn-new-shortlist-view')?.classList.add('hidden');
    document.getElementById('main-filters')?.classList.remove('hidden');
    ['discounts', 'about', 'featured', 'cruising-guide'].forEach(page => document.getElementById(`${page}-container`)?.classList.add('hidden'));

    welcomeScreen?.classList.add('hidden');
    document.getElementById('profile-wipe-toast')?.classList.add('hidden');

    if (hash === '') {
        if (searchInput) searchInput.value = '';
        updateSearchClearButton();
        activeFilters = [];
        selectedCardId = null;
        document.getElementById('main-filters')?.classList.add('hidden');
        if(resultsContainer) resultsContainer.innerHTML = '';
        renderWelcomeScreen();
        updateTravelSidebarHighlight();
        return;
    }

    if (hash.startsWith('#venue=')) {
        const id = hash.replace('#venue=', '');
        const venue = venues.find(v => v.Venue_ID === id);
        if (venue && !['Hold', 'Flag'].includes(String(venue.Status || '').trim())) { 
            openVenueModal(venue); 
            applyFilters(); 
        } else {
            showToast('Venue not available or under review');
            window.location.hash = '#results'; 
        }
    } else if (hash === '#results') {
        recordUserInteraction();
        applyFilters();
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
        renderStaticPageView('discounts');
    } else if (hash === '#about') {
        recordUserInteraction();
        renderStaticPageView('about');
    } else if (hash === '#cruising-guide') {
        recordUserInteraction();
        renderStaticPageView('cruising-guide');
    } else if (hash === '#featured') {
        recordUserInteraction();
        renderFeaturedView();
    } else if (hash.startsWith('#shortlist=')) {
        recordUserInteraction();
        const name = decodeURIComponent(hash.replace('#shortlist=', ''));
        renderSingleShortlist(name);
    } else {
        window.location.hash = '#results';
    }

    updateTravelSidebarHighlight();
}

function renderSingleShortlist(name) {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Shortlists', 'shortlists');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    const eIcon = userShortlistEmojis[name] || '📑';
    if(cTitle) cTitle.innerHTML = `${eIcon} ${name}`;
    if(cDesc) cDesc.innerText = "A saved shortlist collection.";
    
    const listIds = userShortlists[name] || [];
    const matchingVenues = (venues||[]).filter(v => listIds.includes(v.Venue_ID));
    renderListings(matchingVenues, true);
}

async function renderStaticPageView(page) {
    document.getElementById('main-filters')?.classList.add('hidden');
    if(resultsContainer) resultsContainer.innerHTML = '';
    ['discounts', 'about', 'featured', 'cruising-guide'].forEach(p => {
        if(p !== page) document.getElementById(`${p}-container`)?.classList.add('hidden');
    });
    const container = document.getElementById(`${page}-container`);
    if(!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `<p class="body-font">Loading content...</p>`;
    try {
        const res = await fetch(`${page}.html?v=${Date.now()}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const main = doc.querySelector('main');
        container.innerHTML = main ? main.innerHTML : doc.body.innerHTML;
    } catch (e) {
        container.innerHTML = `<h2 class="display-font" style="color:var(--primary-blue);">Content not available</h2><p class="body-font">This page could not be loaded.</p>`;
    }
}

function renderBlankPageView(page) {
    renderStaticPageView(page);
}

function renderWelcomeScreen() {
    const wName = document.getElementById('welcome-name');
    const wAvatar = document.getElementById('welcome-avatar');
    // v0.66 Dynamic Fallback Name
    let dispName = 'GUEST';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label;
    }
    
    if(wName) wName.innerText = dispName;
    if(wAvatar && userProfile.avatar) wAvatar.src = `Profile_images/${userProfile.avatar}`;
    welcomeScreen?.classList.remove('hidden');
}

function renderDiscountsView() {
    renderStaticPageView('discounts');
}

function renderFeaturedView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    if (resultsContainer) resultsContainer.innerHTML = '';
    const container = document.getElementById('featured-container');
    if (!container) return;
    container.classList.remove('hidden');

    const featVenues = getPublicVenues().filter(v => ['1','2','3'].includes(normalizeFeaturedLevel(v)));
    const levelLabels = { '1': 'Top Picks', '2': 'Recommended', '3': 'Also Featured' };
    const cities = [...new Set(featVenues.flatMap(v => getCityTokens(v)).filter(Boolean))].sort();
    let html = `<h2 class="display-font" style="color:var(--primary-blue); margin-bottom:5px;">🏛️ FEATURED VENUES</h2>`;
    html += `<p class="body-font" style="margin-bottom:15px; color:#fff;">${systemInfo.featured_page_intro || 'Below are some of our favourite venues.'}</p>`;
    if(cities.length) html += `<div class="featured-city-strip" style="display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; flex-wrap:wrap;">${cities.map(c => `<button class="chip pill-btn" onclick="const s=document.getElementById('search-input'); if(s) s.value='${String(c).replace(/'/g, "\\'")}'; updateSearchClearButton(); window.location.hash='#results'; handleRouting();">${c}</button>`).join('')}</div>`;

    if(!featVenues.length) {
        html += `<p class="body-font" style="color:var(--text-light);">No featured venues have been added yet.</p>`;
        container.innerHTML = html;
        return;
    }

    ['1','2','3'].forEach(level => {
        const levelVenues = sortFeaturedVenues(featVenues.filter(v => normalizeFeaturedLevel(v) === level));
        if(levelVenues.length) {
            html += `<section class="featured-section" style="margin-bottom:28px;"><h3 class="display-font" style="margin:0 0 12px; color:var(--primary-blue);">${levelLabels[level]}</h3><div id="featured-level-${level}" class="featured-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px;"></div></section>`;
        }
    });
    container.innerHTML = html;
    ['1','2','3'].forEach(level => {
        const grid = document.getElementById(`featured-level-${level}`);
        if(grid) renderListings(sortFeaturedVenues(featVenues.filter(v => normalizeFeaturedLevel(v) === level)), true, grid);
    });
}

// --- Tutorial System ---
let currentTutorialSteps = [];
let currentTutorialStepIndex = 0;
let currentTutorialType = '';

function startTutorial(type) {
    isTutorialRunning = true; 
    
    // v0.66 Tutorial Reset & Hardcode Anchor
    if (type === 'general') {
        window.location.hash = '#results'; // Clear views
        activeFilters = []; // Clear filters
        const searchInputEl = document.getElementById('search-input');
        if(searchInputEl) {
            searchInputEl.value = "Berlin";
            applyFilters(); 
            // Force Lab to open immediately so it's ready for highlighting
            const labVenue = venues.find(x => x.Venue_ID === 'BER-LAB-01');
            if(labVenue) openVenueModal(labVenue);
        }
    }

    currentTutorialType = type;
    currentTutorialStepIndex = 0;
    if (type === 'general') {
        currentTutorialSteps = [
            { target: '#search-input', text: 'Search for venues by name, city, or specific tags.' },
            { target: '#btn-location', text: 'Set your location and see venues closest to you.' },
            { target: '#filter-chips', text: 'Use dynamic filter pills to sort results.' },
            { target: '#btn-favorites', text: 'View your locally saved Favourite venues.' },
            { target: '#btn-shortlists-menu', text: 'Create and view named venue collections.' },
            { target: '.card', text: 'Click any venue card to select it.' },
            { target: '.card.selected', text: 'Double tap a selected card to open its full profile.' },
            { target: '#modal-star', text: 'Use these buttons to favourite, shortlist, report, or share.' },
            { target: '.ratings-table', text: 'Check out detailed venue ratings.' },
            { target: '.social-bar', text: 'Quickly access the venue\'s social media and websites.' },
            { target: '.full-width-about', text: 'Read detailed descriptions and opening hours.' },
            { target: '.events-block', text: 'Scroll down to see upcoming events hosted here.' },
            { target: '.event-card .fav-btn', text: 'Click the heart to save events to your personal list.' },
            { target: '#btn-profile-tutorial', text: 'Do you want to go to the Profile tutorial now? Click "Yes" below!' }
        ];
    } else if (type === 'profile') {
        currentTutorialSteps = [
            { target: '#profile-name', text: 'Enter your custom profile name here.', action: 'mob_tab_1' },
            { target: '#avatar-grid', text: 'Choose your avatar from the grid.', action: 'mob_tab_2' },
            { target: '#avatar-filters', text: 'Select filter tags to find the perfect avatar.', action: 'mob_tab_2' },
            { target: '#btn-save-profile', text: 'Click this to save your current active profile to this browser.', action: 'mob_tab_3' },
            { target: '#profile-switcher', text: 'Switch between your saved profiles easily.', action: 'mob_tab_3' },
            { target: '#btn-new-profile', text: 'Create a new profile from scratch.', action: 'mob_tab_3' },
            { target: '#btn-profile-download-data', text: 'You are in control of your own data. We do not store any information online so there is no risk of data breaches. If you clear your cache in your browser everything you have saved will be gone unless you download your data and then import it all. We recommend you store this on your online Google Drive or Apple Drive.', action: 'mob_tab_3' }
        ];
    }
    
    const toast = document.getElementById('tutorial-toast');
    if(toast) {
        toast.classList.remove('hidden');
        showNextTutorialStep();
        setupTutorialDrag();
    }
}

function showNextTutorialStep() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    
    if (currentTutorialStepIndex >= currentTutorialSteps.length) {
        endTutorial();
        return;
    }
    
    const step = currentTutorialSteps[currentTutorialStepIndex];

    if (window.innerWidth < 768 && step.action && step.action.startsWith('mob_tab_')) {
        const tabNum = parseInt(step.action.replace('mob_tab_', ''));
        if (typeof switchProfileTab === 'function') {
            switchProfileTab(tabNum);
        }
    }

    const targetEl = document.querySelector(step.target);
    if (targetEl) {
        targetEl.classList.add('tutorial-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    const msgEl = document.getElementById('tutorial-message');
    if (msgEl) msgEl.innerText = step.text;
    
    const nextBtn = document.getElementById('btn-tutorial-next');
    const skipBtn = document.getElementById('btn-tutorial-skip');
    
    if (nextBtn && skipBtn) {
        if (currentTutorialStepIndex === currentTutorialSteps.length - 1) {
            if(currentTutorialType === 'general') {
                nextBtn.innerText = "Yes, go to profile";
                skipBtn.innerText = "End tutorial";
                nextBtn.onclick = () => { endTutorial(); startTutorial('profile'); document.getElementById('btn-profile-menu').click(); };
            } else {
                nextBtn.innerText = "Finish ✔️";
                nextBtn.onclick = showNextTutorialStep;
                skipBtn.innerText = "Skip";
            }
        } else {
            nextBtn.innerText = "Next Step ▶";
            nextBtn.onclick = showNextTutorialStep;
            skipBtn.innerText = "Skip";
        }
    }
    
    currentTutorialStepIndex++;
}

function endTutorial() {
    isTutorialRunning = false; 
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    document.getElementById('tutorial-toast')?.classList.add('hidden');
    currentTutorialSteps = [];
    currentTutorialStepIndex = 0;
}

function runTutorial() {
    startTutorial('general');
}

function setupTutorialDrag() {
    const windowEl = document.querySelector('#tutorial-toast .toast');
    const headerEl = windowEl.querySelector('h3');
    if(!headerEl || !windowEl || windowEl.dataset.dragSet) return;
    
    headerEl.style.cursor = 'move';
    let isDragging = false, startX, startY, initialLeft, initialTop;
    
    headerEl.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = windowEl.getBoundingClientRect();
        windowEl.style.transform = 'none'; 
        windowEl.style.bottom = 'auto'; 
        initialLeft = rect.left; initialTop = rect.top;
        windowEl.style.left = initialLeft + 'px';
        windowEl.style.top = initialTop + 'px';
        windowEl.style.position = 'fixed';
    });
    document.addEventListener('mousemove', (e) => {
        if(isDragging) {
            windowEl.style.left = (initialLeft + e.clientX - startX) + 'px';
            windowEl.style.top = (initialTop + e.clientY - startY) + 'px';
        }
    });
    document.addEventListener('mouseup', () => isDragging = false);
    windowEl.dataset.dragSet = 'true';
}

function updateSearchClearButton() {
    const clearBtn = document.getElementById('search-clear');
    if (!clearBtn || !searchInput) return;
    clearBtn.classList.toggle('hidden', !searchInput.value.trim());
}

function resetBackButton(label = '← Back to Results', target = 'results') {
    const btn = document.getElementById('btn-back-to-results');
    if (!btn) return;
    btn.textContent = label;
    btn.dataset.backTarget = target;
}

function formatReportTimestamp(date = new Date()) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yy} ${hh}-${min}-${ss}`;
}

window.flagListing = function(id, name, type="Venue/Event") {
    const modal = document.getElementById('formsubmit-modal');
    if(modal) {
        const fsId = document.getElementById('fs-id');
        const fsName = document.getElementById('fs-name');
        const fsType = document.getElementById('fs-type');
        const fsUrl = document.getElementById('fs-url');

        if(fsId) fsId.value = id;
        if(fsName) fsName.value = name;
        if(fsType) fsType.value = type;
        if(fsUrl) fsUrl.value = window.location.href;

        const nameInp = modal.querySelector('input[name="name"]');
        const emailInp = modal.querySelector('input[name="email"]');
        if(nameInp && !nameInp.value) nameInp.value = userProfile.name || 'Backroom User';
        if(emailInp && !emailInp.value) emailInp.value = systemInfo.form_default_email || 'your@email.com';

        const msg = modal.querySelector('textarea[name="message"]');
        if(msg) {
            const cleanId = String(id || '').trim();
            const cleanName = String(name || '').trim();
            if(cleanId && cleanId !== 'N/A') {
                msg.value = `Report problem with ${cleanId} ${cleanName} ${formatReportTimestamp()}
--------------------------
Type your message here`;
                msg.selectionStart = msg.selectionEnd = msg.value.length;
            } else if(!msg.value.trim()) {
                msg.value = 'Type your message here';
                msg.select();
            }
        }

        modal.classList.remove('hidden');
    }
};


function getCurrentProfileFormName() {
    return document.getElementById('profile-name')?.value.trim() || '';
}

function markProfileOpenState() {
    profileOpenName = userProfile.name || '';
    profileOpenAvatar = userProfile.avatar || '';
}

function hasUnsavedProfileChanges() {
    return getCurrentProfileFormName() !== profileOpenName || (userProfile.avatar || '') !== profileOpenAvatar;
}

function hideProfileUnsavedModal() {
    document.getElementById('profile-unsaved-modal')?.classList.add('hidden');
}

function showProfileUnsavedModal() {
    document.getElementById('profile-unsaved-modal')?.classList.remove('hidden');
}

function setupEventListeners() {
    const addEvt = (id, evt, func) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(evt, func);
    };

    const fsForm = document.getElementById('fs-form');
    if(fsForm && !fsForm.dataset.submitBound) {
        fsForm.dataset.submitBound = 'true';
        fsForm.addEventListener('submit', () => {
            fsForm.action = FORMSUBMIT_ENDPOINT;
            fsForm.method = 'POST';
            fsForm.target = '_blank';
            showToast('Continue in the FormSubmit tab to complete verification.');
            document.getElementById('formsubmit-modal')?.classList.add('hidden');
            setTimeout(() => fsForm.removeAttribute('target'), 1500);
        });
    }

    addEvt('btn-formsubmit-newtab', 'click', () => {
        const form = document.getElementById('fs-form');
        if (!form) return;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        form.action = FORMSUBMIT_ENDPOINT;
        form.method = 'POST';
        form.target = '_blank';
        showToast('Continue in the FormSubmit tab to complete verification.');
        HTMLFormElement.prototype.submit.call(form);
        setTimeout(() => form.removeAttribute('target'), 1500);
    });

    addEvt('btn-formsubmit-flow-close', 'click', () => {
        document.getElementById('formsubmit-flow-modal')?.classList.add('hidden');
        const form = document.getElementById('fs-form');
        if(form) form.removeAttribute('target');
    });


    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if(modal && modal.id === 'profile-modal' && hasUnsavedProfileChanges()) {
                showProfileUnsavedModal();
                return;
            }
            modal?.classList.add('hidden');
        });
    });
    
    addEvt('close-modal', 'click', closeVenueModalToPreviousView);

    addEvt('btn-location', 'click', () => {
        locModal?.classList.remove('hidden');
    });
    addEvt('btn-close-to-me-location', 'click', () => showToast(systemInfo.labels?.coming_soon || 'Coming soon'));
    
    addEvt('btn-settings', 'click', () => settingsModal?.classList.remove('hidden'));
    addEvt('btn-profile-menu', 'click', openProfileMenu);
    const previewShortcut = document.getElementById('preview-img-wrapper');
    if(previewShortcut && !previewShortcut.dataset.avatarShortcutBound) {
        previewShortcut.dataset.avatarShortcutBound = 'true';
        previewShortcut.addEventListener('click', () => {
            if(window.innerWidth <= 768 && typeof window.switchProfileTab === 'function') window.switchProfileTab(2);
        });
    }
    addEvt('btn-save-profile-unsaved', 'click', () => {
        document.getElementById('btn-save-profile')?.click();
        profileModal?.classList.add('hidden');
    });
    addEvt('btn-discard-profile-unsaved', 'click', () => {
        hideProfileUnsavedModal();
        const nameInp = document.getElementById('profile-name');
        if(nameInp) nameInp.value = profileOpenName || '';
        userProfile.name = profileOpenName || '';
        userProfile.avatar = profileOpenAvatar || '';
        renderProfileAvatars();
        updateProfileDisplay();
        profileModal?.classList.add('hidden');
    });
    addEvt('btn-favorites', 'click', () => window.location.hash = '#favorites');
    addEvt('btn-shortlists-menu', 'click', () => window.location.hash = '#myshortlists');
    
    addEvt('btn-sidebar-travel', 'click', () => {
        const drop = document.getElementById('travel-dropdown');
        drop?.classList.toggle('hidden');
        renderTravelDropdown();
    });

    addEvt('btn-tutorial-skip', 'click', endTutorial);
    addEvt('btn-profile-tutorial', 'click', () => startTutorial('profile'));

    addEvt('btn-language', 'click', () => showToast("Coming soon!")); 
    addEvt('btn-back-to-results', 'click', () => {
        const btn = document.getElementById('btn-back-to-results');
        const target = btn?.dataset.backTarget || 'results';
        if(target === 'shortlists') {
            window.location.hash = '#myshortlists';
        } else {
            if(searchInput) searchInput.value = '';
            updateSearchClearButton();
            window.location.hash = '#results';
            updateTravelSidebarHighlight();
        }
    });

    addEvt('btn-save-location', 'click', saveLocation);
    addEvt('btn-clear-location', 'click', clearLocation);
    
    addEvt('btn-gps', 'click', () => {
        showToast('Hold up a few seconds, we are confirming your location.');
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
    addEvt('import-profile-file', 'change', importUserData); 

    addEvt('btn-add-create-shortlist', 'click', () => {
        const nameInp = document.getElementById('add-new-shortlist-name');
        if(!nameInp) return;
        const name = nameInp.value.trim();
        if(name && currentTargetVenue) { 
            userShortlists[name] = [currentTargetVenue.Venue_ID]; 
            userShortlistEmojis[name] = SHORTLIST_EMOJIS[Math.floor(Math.random() * SHORTLIST_EMOJIS.length)]; 
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
        markProfileOpenState();
        hideProfileUnsavedModal();
        updateProfileDisplay();
        showToast("Profile saved locally!");
        if(window.location.hash === '' && searchInput?.value === '') renderWelcomeScreen();
    });

    addEvt('btn-new-profile', 'click', () => {
        document.getElementById('profile-wipe-toast')?.classList.remove('hidden');
    });

    addEvt('btn-wipe-all', 'click', () => {
        userProfile = { name: '', avatar: '' };
        userFavorites = []; userShortlists = {}; userEvents = []; userTravel = [];
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Started fresh blank profile.");
    });

    addEvt('btn-wipe-profile-only', 'click', () => {
        userProfile = { name: '', avatar: '' };
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('profile-wipe-toast')?.classList.add('hidden');
        showToast("Profile copied. Choose a new name.");
    });
    
    addEvt('btn-delete-profile', 'click', () => {
        if(!userProfile.name) { showToast("No active profile to delete."); return; }
        const delModal = document.getElementById('delete-profile-modal');
        if(delModal) delModal.classList.remove('hidden');
    });

    addEvt('btn-confirm-delete-profile', 'click', () => {
        if(userProfile.name) {
            delete savedProfiles[userProfile.name];
            localStorage.setItem('br_saved_profiles', JSON.stringify(savedProfiles));
        }
        userProfile = { name: '', avatar: '' };
        userFavorites = []; userShortlists = {}; userEvents = []; userTravel = [];
        saveCurrentToBundle();
        const pName = document.getElementById('profile-name');
        if(pName) pName.value = '';
        renderProfileAvatars();
        updateProfileDisplay();
        document.getElementById('delete-profile-modal')?.classList.add('hidden');
        showToast("Profile deleted.");
        if(window.location.hash === '' && searchInput?.value === '') renderWelcomeScreen();
    });

    addEvt('btn-cancel-delete-profile', 'click', () => {
        document.getElementById('delete-profile-modal')?.classList.add('hidden');
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

    if(hitArea && sidebar && !document.body.dataset.sidebarBound) {
        document.body.dataset.sidebarBound = 'true';
        hitArea.addEventListener('click', (e) => { e.stopPropagation(); openSidebarTemporarily(); });
        hitArea.addEventListener('touchstart', (e) => { e.stopPropagation(); openSidebarTemporarily(); }, {passive:true});
        sidebar.addEventListener('click', (e) => {
            if(sidebar.classList.contains('sidebar-opening')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }
        }, true);
        sidebar.addEventListener('click', (e) => { e.stopPropagation(); openSidebarTemporarily(); });
        document.addEventListener('click', (e) => {
            if(!sidebar.classList.contains('visible')) return;
            if(e.target.closest('#sidebar') || e.target.closest('#sidebar-hit-area')) return;
            closeSidebarImmediately();
        });
        document.addEventListener('touchstart', (e) => {
            if(!sidebar.classList.contains('visible')) return;
            if(e.target.closest('#sidebar') || e.target.closest('#sidebar-hit-area')) return;
            closeSidebarImmediately();
        }, {passive:true});
        updateMobileSidebarOffset();
    }

    if(searchInput) {
        searchInput.addEventListener('input', () => { recordUserInteraction(); updateSearchClearButton(); window.location.hash='#results'; handleRouting(); });
        updateSearchClearButton();
    }
    const searchClear = document.getElementById('search-clear');
    if(searchClear) {
        searchClear.addEventListener('click', () => {
            if(searchInput) searchInput.value = '';
            updateSearchClearButton();
            recordUserInteraction();
            window.location.hash = '#results';
            handleRouting();
        });
    }
    addEvt('btn-save-profile-inline', 'click', () => document.getElementById('btn-save-profile')?.click());
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

    let dispName = '👤';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label; // v0.66 Fallback Name Logic
    }

    topName.innerText = dispName;

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
        item.innerHTML = `<span style="flex-grow:1;" onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash='#results'; handleRouting();">${city}</span>`;
        list.appendChild(item);
    });
}

// =================== part 2 ================

function updateTravelSidebarHighlight() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    const items = document.querySelectorAll('#travel-cities-list .submenu-item');
    items.forEach(item => {
        const spanText = item.querySelector('span').innerText.toLowerCase();
        if(spanText === query && window.location.hash === '#results') {
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

function renderDynamicFilters(filteredData) {
    const container = document.getElementById('filter-chips');
    if(!container) return;

    const availableTags = new Set();
    const availabilitySource = Array.isArray(filteredData) ? filteredData : getPublicVenues();
    availabilitySource.forEach(v => getVenueTags(v).forEach(t => availableTags.add(t)));
    activeFilters.forEach(t => availableTags.add(t));

    let html = `<button class="chip pill-btn ${activeFilters.length === 0 ? 'active' : ''}" data-filter="All">All</button>`;
    html += `<button class="chip pill-btn tag-social-yellow" data-filter="__close_to_me">Venues close to me</button>`;

    MASTER_VIBE_TAGS.forEach(tag => {
        const colorClass = getTagColorClass(tag);
        const isActive = activeFilters.includes(tag);
        const isAvailable = availableTags.has(tag);
        const isDisabled = (!isAvailable && !isActive);
        const disabledClass = isDisabled ? 'muted-chip' : '';
        const disabledAttrs = isDisabled ? ' data-disabled="true" aria-disabled="true" title="No matching venues with current filters"' : '';
        html += `<button class="chip pill-btn ${colorClass} ${isActive ? 'active' : ''} ${disabledClass}" data-filter="${tag}"${disabledAttrs}>${tag}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            recordUserInteraction();
            if(e.currentTarget.dataset.disabled === 'true') {
                showToast('No matching venues with current filters.');
                return;
            }
            const tag = e.currentTarget.getAttribute('data-filter');

            if(tag === '__close_to_me') {
                showToast('Coming soon');
                return;
            }

            if(tag === 'All') {
                activeFilters = [];
            } else {
                const idx = activeFilters.indexOf(tag);
                if(idx > -1) activeFilters.splice(idx, 1);
                else activeFilters.push(tag);
            }
            if(window.location.hash !== '#results') window.location.hash = '#results';
            else handleRouting();
        });
    });
}

function applyFilters() {
    const query = searchInput?.value || '';
    let filteredVenues = getPublicVenues();
    selectedCardId = null;

    if(activeFilters.length > 0) {
        filteredVenues = filteredVenues.filter(v => {
            const tags = getVenueTags(v);
            return activeFilters.every(af => tags.includes(af));
        });
    }

    if(query.trim() !== '') {
        filteredVenues = filteredVenues.filter(v => fuzzyMatch(getVenueSearchText(v), query));
    }

    filteredVenues.sort((a, b) => {
        const queryCity = query.trim().toLowerCase();
        if (queryCity) {
            const aCityMatch = venueMatchesCity(a, queryCity);
            const bCityMatch = venueMatchesCity(b, queryCity);
            if (aCityMatch && bCityMatch && isMultiCityVenue(a) !== isMultiCityVenue(b)) return isMultiCityVenue(a) ? 1 : -1;
        }

        const aShop = getVenueTags(a).includes('Shop') ? 1 : 0;
        const bShop = getVenueTags(b).includes('Shop') ? 1 : 0;
        if (aShop !== bShop) return aShop - bShop;

        const aHasImg = (a.Image_URL && a.Image_URL.trim() !== '') ? 1 : 0;
        const bHasImg = (b.Image_URL && b.Image_URL.trim() !== '') ? 1 : 0;
        if (aHasImg !== bHasImg) return bHasImg - aHasImg; 

        const aPriority = parseInt(normalizeFeaturedLevel(a)) || 99;
        const bPriority = parseInt(normalizeFeaturedLevel(b)) || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const aSize = parseInt(a.Rating_Size) || 0;
        const bSize = parseInt(b.Rating_Size) || 0;
        if (aSize !== bSize) return bSize - aSize; 

        const aPop = parseInt(a.Rating_Busyness || a.Rating_Popularity) || 0;
        const bPop = parseInt(b.Rating_Busyness || b.Rating_Popularity) || 0;
        return bPop - aPop; 
    });

    if(contextHeader) {
        contextHeader.classList.remove('hidden');
        resetBackButton('← Back to Results', 'results');
        document.getElementById('btn-back-to-results')?.classList.add('result-back-hidden');
        const title = document.getElementById('context-title');
        const desc = document.getElementById('context-desc');
        const parts = [];
        if(query.trim()) parts.push(`search: ${query.trim()}`);
        if(activeFilters.length) parts.push(`filters: ${activeFilters.join(', ')}`);
        if(title) title.innerText = parts.length ? `Showing results for ${parts.join(' + ')}` : 'Results';
        if(desc) desc.innerText = `${filteredVenues.length} results found`;
    }

    renderListings(filteredVenues);
    renderDynamicFilters(filteredVenues);
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
    document.getElementById('btn-back-to-results')?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
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
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = "💖 MY EVENTS";
    if(cDesc) cDesc.innerText = "Events you have pinned locally.";
    
    const cityFilterContainer = document.getElementById('event-city-filters');
    if(cityFilterContainer) {
        cityFilterContainer.classList.remove('hidden');
        cityFilterContainer.innerHTML = '';
    }
    
    let myEvts = (events||[]).filter(e => userEvents.includes(e.Event_ID)).map(e => getEventDisplayOccurrence(e)).filter(Boolean).sort(compareEventOccurrences);
    
    if(myEvts.length === 0) {
        if(resultsContainer) resultsContainer.innerHTML = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No saved events.</p>`;
        cityFilterContainer?.classList.add('hidden');
        return;
    }

    const cities = new Set();
    myEvts.forEach(ev => {
        const venue = (venues||[]).find(v => v.Venue_ID === ev.Venue_ID);
        if(venue) getCityTokens(venue).forEach(city => cities.add(city));
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
            return venue && venueMatchesCity(venue, currentEventCityFilter);
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
                    <div><h3 class="card-title display-font">${ev.Event_Name}</h3><div class="card-meta">${getEventDisplayMeta(ev)}${getEventDisplayMeta(ev) ? ' | ' : ''}@ ${venueName}</div></div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span class="icon-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${ev.Event_ID}#myevents', '${ev.Event_Name.replace(/'/g, "\\'")}')" title="Share" style="font-size:1.5rem;">${BR_ICONS.share}</span>
                        <span class="icon-btn" onclick="event.stopPropagation(); window.flagListing('${ev.Event_ID}', '${ev.Event_Name.replace(/'/g, "\\'")}', 'Event Report')" title="Report" style="display:flex; align-items:center; justify-content:center;"><img src="report.png" style="width:24px; height:24px; object-fit:contain;"></span>
                        <button class="icon-btn fav-btn active-star" style="font-size:1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', null, true)">❌</button>
                    </div>
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
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
    
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
                <div onclick="const s = document.getElementById('search-input'); if(s) s.value='${city}'; window.location.hash='#results'; handleRouting();" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${city}</h3>
                </div>
                <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete ${city}?')){ removeTravel('${city}'); }">❌</button>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

window.openEmojiPicker = function(listName) {
    const listHtml = SHORTLIST_EMOJIS.map(e => `<span style="font-size:1.5rem; cursor:pointer; padding:5px;" onclick="userShortlistEmojis['${listName}']='${e}'; saveCurrentToBundle(); renderShortlistsFullView(); document.getElementById('emoji-picker-modal').classList.add('hidden');">${e}</span>`).join('');
    let modal = document.getElementById('emoji-picker-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'emoji-picker-modal';
        modal.className = 'modal hidden';
        modal.style.zIndex = '4000';
        modal.innerHTML = `
            <div class="modal-content small-modal" style="background:var(--panel-dark); max-width: 300px;">
                <div class="modal-header"><h3 class="display-font" style="margin:0; font-size:1.2rem;">Pick Icon</h3><button class="btn-close" onclick="document.getElementById('emoji-picker-modal').classList.add('hidden');" style="position:relative; right:auto; top:auto;">❌</button></div>
                <div class="modal-body" style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.querySelector('.modal-body').innerHTML = listHtml;
    modal.classList.remove('hidden');
}

function shareShortlist(name) {
    const eIcon = userShortlistEmojis[name] || '📑';
    const ids = userShortlists[name].join(',');
    const url = `${window.location.origin}${window.location.pathname}#sharedlist?title=${encodeURIComponent(name)}&emoji=${encodeURIComponent(eIcon)}&ids=${ids}`;
    shareURL(url, `Backroom Shortlist: ${name}`);
}

function renderShortlistsFullView() {
    document.getElementById('main-filters')?.classList.add('hidden');
    contextHeader?.classList.remove('hidden');
    const backBtn = document.getElementById('btn-back-to-results');
    backBtn?.classList.remove('result-back-hidden');
    resetBackButton('← Back to Results', 'results');
    
    const cTitle = document.getElementById('context-title');
    const cDesc = document.getElementById('context-desc');
    if(cTitle) cTitle.innerHTML = `<img src="shortlist.png" style="width:55px; vertical-align:bottom; margin-right:8px;"> MY SHORTLISTS`;
    if(cDesc) cDesc.innerText = "Make a list and share it with your friends so they know where to go tonight!";
    
    const newBtn = document.getElementById('btn-new-shortlist-view');
    if(newBtn) {
        newBtn.classList.remove('hidden');
        newBtn.onclick = () => {
            const name = prompt("Enter new shortlist name:");
            if(name && name.trim() !== '') {
                userShortlists[name.trim()] = [];
                userShortlistEmojis[name.trim()] = SHORTLIST_EMOJIS[Math.floor(Math.random() * SHORTLIST_EMOJIS.length)];
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
        const eIcon = userShortlistEmojis[name] || '📑';
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-inner-content" style="flex-direction:row; justify-content:space-between; align-items:center;">
                <div style="font-size:2rem; margin-right:15px; cursor:pointer;" onclick="event.stopPropagation(); openEmojiPicker('${name}')" title="Tap to change icon">${eIcon}</div>
                <div onclick="window.location.hash='#shortlist=${encodeURIComponent(name)}';" style="flex-grow:1;">
                    <h3 class="card-title display-font" style="color:var(--primary-blue);">${name}</h3>
                    <p class="meta-text" style="margin-top:5px;">${count} venue${count === 1 ? '' : 's'}</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="icon-btn" onclick="event.stopPropagation(); shareShortlist('${name}')" title="Share" style="font-size:1.35rem;">${BR_ICONS.share}</button>
                    <button class="icon-btn" style="color:var(--bright-red-orange);" onclick="event.stopPropagation(); if(confirm('Delete shortlist ${name}?')){ delete userShortlists['${name}']; saveCurrentToBundle(); renderShortlistsFullView(); }">❌</button>
                </div>
            </div>
        `;
        if(resultsContainer) resultsContainer.appendChild(card);
    });
}

window.switchProfileTab = function(step) {
    const p1 = document.getElementById('profile-mob-view-1');
    const p2 = document.getElementById('profile-mob-view-2');
    const p3 = document.getElementById('profile-mob-view-3');
    
    const t1 = document.getElementById('ptab-1');
    const a1 = document.getElementById('parr-1');
    const t2 = document.getElementById('ptab-2');
    const a2 = document.getElementById('parr-2');
    const t3 = document.getElementById('ptab-3');

    if(p1 && p2 && p3 && t1 && t2 && t3) {
        p1.classList.add('mobile-hidden-tab');
        p2.classList.add('mobile-hidden-tab');
        p3.classList.add('mobile-hidden-tab');
        
        [t1, t2, t3].forEach(t => { t.classList.remove('tutorial-highlight'); t.classList.remove('active-profile-tab'); });
        
        if(a1) { a1.classList.remove('tutorial-highlight'); a1.classList.remove('active-profile-tab'); }
        if(a2) { a2.classList.remove('tutorial-highlight'); a2.classList.remove('active-profile-tab'); }

        if(step === 1) { 
            p1.classList.remove('mobile-hidden-tab'); 
            t1.classList.add('tutorial-highlight', 'active-profile-tab');
            if(a1) a1.classList.add('tutorial-highlight', 'active-profile-tab');
        }
        else if(step === 2) { 
            p2.classList.remove('mobile-hidden-tab'); 
            t2.classList.add('tutorial-highlight', 'active-profile-tab');
            if(a2) a2.classList.add('tutorial-highlight', 'active-profile-tab');
        }
        else if(step === 3) { 
            p3.classList.remove('mobile-hidden-tab'); 
            t3.classList.add('tutorial-highlight', 'active-profile-tab');
        }
    }
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
        filterContainer.style.flexWrap = 'wrap';
        filterContainer.style.justifyContent = 'center';
        filterContainer.style.gap = '8px';
        filterContainer.style.marginBottom = '15px';
        grid.parentNode.insertBefore(filterContainer, grid);
    }
    
    const ageTags = ['Young', 'Prime', 'Mature'];
    const funTags = ['Fun'];
    const fetishTags = ['Ink', 'Inked', 'Leather', 'Rubber', 'Puppy'];
    
    let html = `<div class="tag-row-blue" style="display:flex; justify-content:center; gap:8px;">`;
    html += `<button class="chip pill-btn ${activeAvatarCategories.length === 0 ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; flex-shrink:0;" data-val="All">All</button>`;
    html += ageTags.map(c => `<button class="chip pill-btn ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: var(--primary-blue); border-color: var(--primary-blue); flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div><div class="tag-row-yellow" style="display:flex; justify-content:center; gap:8px;">`;
    html += funTags.map(c => `<button class="chip pill-btn avatar-fun-chip ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: #f3c743; border-color: #f3c743; flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div><div class="tag-row-red" style="display:flex; justify-content:center; gap:8px;">`;
    html += fetishTags.map(c => `<button class="chip pill-btn ${activeAvatarCategories.includes(c) ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.85rem; color: var(--bright-red-orange); border-color: var(--bright-red-orange); flex-shrink:0;" data-val="${c}">${c}</button>`).join('');
    html += `</div>`;

    filterContainer.innerHTML = html;
    
    filterContainer.querySelectorAll('.chip').forEach(btn => {
        btn.onclick = () => { 
            const val = btn.getAttribute('data-val');
            if(val === 'All') activeAvatarCategories = [];
            else {
                const idx = activeAvatarCategories.indexOf(val);
                if(idx > -1) activeAvatarCategories.splice(idx, 1);
                else activeAvatarCategories.push(val);
            }
            renderProfileAvatars(); 
        };
    });

    let displayData = [...avatarData];
    if (activeAvatarCategories.length === 0) {
        displayData.unshift({ file: 'noavatar01.png', label: 'Default', category: [] });
    }

    const filteredData = activeAvatarCategories.length === 0 ? displayData : displayData.filter(a => {
        let cats = Array.isArray(a.category) ? a.category : [a.category];
        return activeAvatarCategories.every(cat => cats.includes(cat));
    });

    filteredData.forEach(avatar => {
        const item = document.createElement('div');
        item.className = 'avatar-item';
        if (avatar.file === userProfile.avatar) item.classList.add('selected');
        
        // v0.66 Title fallback for desktop span hiding
        item.innerHTML = `<img src="Profile_images/${avatar.file}" onerror="this.parentElement.style.display='none';" alt="${avatar.label}" title="${avatar.label}"><span>${avatar.label}</span>`;
        
        item.addEventListener('click', () => {
            userProfile.avatar = avatar.file;
            showToast(`You selected ${avatar.label || avatar.file}`);
            const previewImg = document.getElementById('profile-avatar-preview');
            if(previewImg) {
                previewImg.src = `Profile_images/${avatar.file}`;
                previewImg.parentElement.classList.remove('hidden');
            }
            
            document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
        });
        grid.appendChild(item);
    });
    
    const initialPreviewImg = document.getElementById('profile-avatar-preview');
    if(initialPreviewImg) {
        if(userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
            initialPreviewImg.src = `Profile_images/${userProfile.avatar}`;
            initialPreviewImg.parentElement.classList.remove('hidden');
        } else {
            initialPreviewImg.parentElement.classList.add('hidden');
        }
    }
}

function renderProfileStats() {
    const container = document.getElementById('profile-stats-container');
    if(!container) return;
    
    const favCount = userFavorites.length;
    const eventCount = userEvents.length;
    const shortCount = Object.keys(userShortlists).length;
    const travelCount = userTravel.length;
    
    let html = `
        <h3 class="desktop-only-text display-font" style="color:var(--primary-blue); margin-bottom:10px; font-size:1.2rem;">YOUR PROFILE CONTAINS</h3>
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
    const mobileHtml = html.replace('desktop-only-text ', '');
    const containerMob = document.getElementById('profile-stats-container-mob');
    if(containerMob) containerMob.innerHTML = '';
    const containerMobFirst = document.getElementById('profile-stats-container-mob-first');
    if(containerMobFirst) containerMobFirst.innerHTML = mobileHtml;
}

function openProfileMenu() {
    const pName = document.getElementById('profile-name');
    if(pName) pName.value = userProfile.name || '';
    renderProfileAvatars();
    renderProfileStats();
    
    if(window.innerWidth <= 768) {
        window.switchProfileTab(1);
    }
    
    // v0.66 Dynamic Fallback welcome string
    const privacyGreeting = document.getElementById('profile-privacy-greeting');
    let dispName = 'Guest';
    if (userProfile.name) {
        dispName = userProfile.name;
    } else if (userProfile.avatar && userProfile.avatar !== 'noavatar01.png') {
        const found = avatarData.find(a => a.file === userProfile.avatar);
        if(found) dispName = found.label; 
    }
    if(privacyGreeting) privacyGreeting.innerText = `Hi ${dispName},`;

    const mobileFunctions = document.querySelector('#profile-mob-view-3 .mobile-only');
    if(mobileFunctions) {
        let mobileHi = document.getElementById('profile-mobile-hi-box');
        if(!mobileHi) {
            mobileHi = document.createElement('div');
            mobileHi.id = 'profile-mobile-hi-box';
            mobileHi.className = 'profile-hi-mobile-box';
            const tutorialButton = document.getElementById('btn-profile-tutorial-mob');
            const btnStack = mobileFunctions.querySelector('.profile-btn-stack');
            if(tutorialButton) tutorialButton.insertAdjacentElement('afterend', mobileHi);
            else if(btnStack) btnStack.appendChild(mobileHi);
            else mobileFunctions.prepend(mobileHi);
        }
        mobileHi.innerHTML = `<h4>Hi ${dispName},</h4><p>In this screen you can edit your profile. Your favorites, shortlists, events, travel pins and profile choices are stored locally in this browser. Export your data if you want a backup.</p>`;
    }

    const profileWipeToast = document.getElementById('profile-wipe-toast');
    if(profileWipeToast) {
        const wipeAllBtn = profileWipeToast.querySelector('#btn-wipe-all');
        const copyBtn = profileWipeToast.querySelector('#btn-wipe-profile-only');
        if(wipeAllBtn) wipeAllBtn.innerText = "Make a new blank profile";
        if(copyBtn) copyBtn.innerText = "Make a copy of this profile";
    }


    markProfileOpenState();
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
        shortlistEmojis: userShortlistEmojis,
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
            if(data.favorites) { userFavorites = data.favorites; localStorage.setItem('br_favorites', JSON.stringify(userFavorites)); }
            if(data.shortlists) { userShortlists = data.shortlists; localStorage.setItem('br_shortlists', JSON.stringify(userShortlists)); }
            if(data.shortlistEmojis) { userShortlistEmojis = data.shortlistEmojis; localStorage.setItem('br_shortlist_emojis', JSON.stringify(userShortlistEmojis)); }
            if(data.events) { userEvents = data.events; localStorage.setItem('br_events', JSON.stringify(userEvents)); }
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

// v0.66 Random Placeholder Infinite Loop Breaker
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
            // v0.66 Random image pool selection
            const randomFallback = PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)];
            imgElement.onerror = null; 
            imgElement.src = randomFallback;
            imgElement.setAttribute('data-index', 1);
            showToast("Double tap the venue name to open");
        };
        tempImg.src = newSrc;
    });
}

function renderListings(data, isContextView = false, targetContainer = resultsContainer) {
    const container = targetContainer || resultsContainer;
    if(container) container.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);

    if(!data || data.length === 0) {
        let emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">No venues found.</p>`;

        const cityInput = document.getElementById('loc-city');
        const userLat = parseFloat(cityInput?.dataset.lat || 'NaN');
        const userLon = parseFloat(cityInput?.dataset.lon || 'NaN');

        if (!isNaN(userLat) && !isNaN(userLon) && venues.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            getPublicVenues().forEach(v => {
                if(!hasFixedCoordinates(v)) return;
                const dist = getDistanceFromLatLonInKm(userLat, userLon, parseFloat(v.Latitude), parseFloat(v.Longitude));
                if (dist < minDist) { minDist = dist; nearest = v; }
            });

            if (nearest && minDist !== Infinity) {
                const distRounded = Math.round(minDist);
                emptyHtml = `<p style="text-align:center; color:var(--label-grey); margin-top:20px; width: 100%; grid-column: 1 / -1;">
                    <img src="location.png" style="width:40px; margin-bottom:10px;"><br>
                    <span style="color: var(--bright-red-orange); font-family: 'Antonio', sans-serif; font-size: 1.5rem; text-transform: uppercase;">No venues found nearby</span><br><br>
                    <a href="javascript:void(0)" onclick="const s = document.getElementById('search-input'); if(s) s.value='${getCityTokens(nearest)[0] || nearest.City}'; window.location.hash='#results'; applyFilters();" style="color:var(--primary-blue); font-weight:bold; font-size:1.1rem; text-decoration:underline;">
                        Closest venue is ${distRounded} km away in ${getCityTokens(nearest)[0] || nearest.City}.<br>Click here to load ${getCityTokens(nearest)[0] || nearest.City}.
                    </a>
                </p>`;
            }
        }
        if(container) container.innerHTML = emptyHtml;
        return;
    }

    data.forEach(venue => {
        let nextEventHtml = '';
        const venueEvents = getVenueEventOccurrences(venue.Venue_ID, { includePast: false, activeOnly: true, now: new Date() });
        if(venueEvents.length > 0) {
            const nextE = venueEvents[0];
            const recurrenceText = nextE.Is_Recurring ? ` · ${nextE.Recurrence_Label}` : '';
            nextEventHtml = `<div class="card-next-event">📅 Next: ${nextE.Event_Name} (${formatDateToDDMMYYYY(getEventDisplayDate(nextE))})${recurrenceText}</div>`;
        }

        const isFav = userFavorites.includes(venue.Venue_ID);
        const shortDescSource = venue.Description || '';
        const shortDesc = shortDescSource.length > 90 ? shortDescSource.substring(0, 90) + '...' : shortDescSource;
        const card = document.createElement('div');
        card.className = 'card';

        const baseImageSrc = (venue.Image_URL && venue.Image_URL.trim()) ? venue.Image_URL.trim() : `Venue_images/${venue.Venue_ID}-01.jpg`;
        const badgeLabel = getCardStatusLabel(venue);
        const badgeClass = getCardStatusClass(venue);

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img class="venue-image centered-image" src="${baseImageSrc}" onerror="this.onerror=null; this.src='${PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)]}'" data-id="${venue.Venue_ID}" data-index="1" title="Tap to see next photo">
            </div>
            <div class="card-inner-content">
                <div class="card-header">
                    <div><h3 class="card-title display-font">${venue.Name || 'Unnamed venue'}</h3><div class="card-meta"><img src="location.png" style="width:14px; vertical-align:middle;"> ${formatVenueLocation(venue)}</div></div>
                    <div class="status-badge ${badgeClass}">${badgeLabel}</div>
                </div>
                <div class="card-about">${shortDesc}</div>
                ${nextEventHtml}
                <div class="card-stats">
                    <span>🌈 ${systemInfo.labels?.rated_by_gays || 'Rated by gays'}</span><span>👁️ ${venue.Views || 0}</span>
                    <div style="margin-left:auto; display:flex; gap:10px; align-items:center;">
                        <span class="icon-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}', '${String(venue.Name || '').replace(/'/g, "\\'")}')" title="Share" style="font-size:1.5rem;">${BR_ICONS.share}</span>
                        <span class="icon-btn" onclick="event.stopPropagation(); window.flagListing('${venue.Venue_ID}', '${String(venue.Name || '').replace(/'/g, "\\'")}', 'Venue Report')" title="Report" style="display:flex; align-items:center; justify-content:center;"><img src="report.png" style="width:24px; height:24px; object-fit:contain;"></span>
                        <span class="star-btn icon-btn fav-btn ${isFav ? 'active-star' : ''}" style="font-size:1.8rem; line-height:1;">⚜️</span>
                    </div>
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
                    venueReturnHash = getCurrentListHashForVenueReturn();
                    window.location.hash = `#venue=${venue.Venue_ID}`; 
                } else {
                    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedCardId = venue.Venue_ID;
                    showToast("Double tap the venue name to open");
                }
            } 
        });
        if(container) container.appendChild(card);
    });
}

function getRatingTooltip(type, val) {
    if(!val) return '';
    const tooltips = {
        'Age': ['Young Crowd', 'Mixed Young', 'Mixed', 'Mixed Mature', 'Mature Crowd'],
        'Size': ['Tiny', 'Small', 'Medium', 'Large', 'Huge'],
        'Overall': ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
        'Darkroom': ['Basic', 'Standard', 'Good', 'Extensive', 'Maze'],
        'Cost': ['Cheap', 'Reasonable', 'Average', 'Expensive', 'Very Expensive'],
        'Location': ['Poorly Connected', 'Okay', 'Good', 'Great', 'Perfectly Located'],
        'Popularity': ['Quiet', 'Moderate', 'Busy', 'Very Busy', 'Packed']
    };
    if(tooltips[type] && tooltips[type][val-1]) return `${val}/5: ${tooltips[type][val-1]}`;
    return `${val}/5`;
}

function getRatingCells(val, type) {
    const raw = val;
    const isBlank = raw === null || raw === undefined || String(raw).trim() === '' || String(raw).toUpperCase() === 'NA' || String(raw).toUpperCase() === 'N/A';
    if (isBlank) {
        return `<div class="rating-not-rated">not yet rated</div>`;
    }

    const numericVal = parseInt(raw, 10);
    if (type === 'Darkroom' && numericVal === 0) {
        return `<div class="rating-no-darkroom" title="No darkroom">🚫</div>`;
    }
    if (Number.isNaN(numericVal) || numericVal <= 0) {
        return `<div class="rating-not-rated">not yet rated</div>`;
    }

    let html = '';
    for(let i=1; i<=5; i++) {
        const op = i <= numericVal ? '1' : '0.25';
        let asset = '';
        let iconSize = '26px';
        if (type === 'Age' || type === 'Popularity') iconSize = '31.2px';
        const tooltip = getRatingTooltip(type, i);
        if (type === 'Size') {
            asset = `<img src="Emoji/size0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else if (type === 'Age') {
            asset = `<img src="Emoji/age0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        } else {
            const map = { 'Overall': 'eggplant', 'General': 'eggplant', 'Darkroom': 'water', 'Cost': 'money', 'Location': 'peach', 'Popularity': 'busy' };
            const prefix = map[type] || 'eggplant';
            asset = `<img src="Emoji/${prefix}0${i}.png" title="${tooltip}" style="width:${iconSize}; height:${iconSize}; vertical-align:middle; object-fit:contain;">`;
        }
        html += `<div class="rating-cell-target" style="opacity:${op}; display:flex; align-items:center; justify-content:center; cursor:pointer;" ontouchstart="event.preventDefault(); this.classList.add('flash-glow'); setTimeout(() => this.classList.remove('flash-glow'), 500); showToast('${tooltip.replace(/'/g, "\\'")}')">${asset}</div>`;
    }
    return html;
}

function openVenueModal(venue) {
    const mTitle = document.getElementById('modal-title');
    if(mTitle) mTitle.innerText = venue.Name;
    
    const dynamicLayout = document.getElementById('modal-dynamic-layout');
    if(!dynamicLayout) return;

    const features = getVenueTags(venue);
    const featureHtml = renderTagPills(features);

    const statsHtml = `
        <div class="public-stats-block">
            <span>🌈 ${systemInfo.labels?.rated_by_gays || 'Rated'}</span> 
            <span>👁️ ${venue.Views || 0}</span>
        </div>
        ${buildSocialBar(venue)}
        <div class="feature-chips" style="margin-top: 15px;">${featureHtml}</div>
    `;
    
    const ratingTypes = [
        { label: 'Overall', key: 'Rating_General', type: 'Overall' },
        { label: 'Age Range', key: 'Rating_Age_Range', type: 'Age' },
        { label: 'Size', key: 'Rating_Size', type: 'Size' },
        { label: 'Darkroom', key: 'Rating_Darkroom', type: 'Darkroom' },
        { label: 'Cost', key: 'Rating_Cost', type: 'Cost' },
        { label: 'Location', key: 'Rating_Location', type: 'Location' },
        { label: 'Popularity', key: 'Rating_Busyness', type: 'Popularity' }
    ];

    let ratingsTableHtml = `<div class="ratings-table" style="display: grid; grid-template-columns: 1fr repeat(5, 30px); gap: 16px 8px; align-items: center; background-color: var(--near-black); padding: 15px; border-radius: var(--radius-card); border: 1px solid var(--panel-mid);">`;
    
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
        ratingsTableHtml += `
            <div style="font-size: 1rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding-right: 10px;">${r.label}</div>
            ${getRatingCells(val, r.type)}
        `;
    });
    
    ratingsTableHtml += `</div>`;

    const venueEvents = getVenueEventOccurrences(venue.Venue_ID, { includePast: true, activeOnly: false, now: new Date() });
    let eventsHtml = '';
    if(venueEvents.length > 0) {
        eventsHtml = `
            <div class="events-block"><h3>📅 UPCOMING EVENTS</h3>
        `;
        venueEvents.forEach(ev => {
            const isPast = ev.Is_Past;
            const isSaved = userEvents.includes(ev.Event_ID);
            const badgeData = getBadgeDateParts(getEventDisplayDate(ev));
            eventsHtml += `
                <div class="event-card">
                    <div class="event-date-badge"><span class="event-day">${badgeData.d}</span><span class="event-month-year">${badgeData.my}</span></div>
                    <div class="event-content">
                        <div class="event-header-row">
                            <div>
                                <strong>${ev.Event_Name}</strong> ${isPast ? '<small>(Past)</small>' : ''}<br>
                                <span class="meta-text">${getEventDisplayMeta(ev)}</span>
                            </div>
                            <div style="display:flex; gap:5px; align-items:center;">
                                <span class="icon-btn" onclick="event.stopPropagation(); shareURL('${window.location.origin}${window.location.pathname}?event=${ev.Event_ID}', '${ev.Event_Name.replace(/'/g, "\'")}')" title="Share" style="font-size:1.2rem;">${BR_ICONS.share}</span>
                                <span class="icon-btn" onclick="event.stopPropagation(); window.flagListing('${ev.Event_ID}', '${ev.Event_Name.replace(/'/g, "\'")}', 'Event Report')" title="Report" style="display:flex; align-items:center; justify-content:center;"><img src="report.png" style="width:20px; height:20px; object-fit:contain;"></span>
                                <button class="icon-btn fav-btn ${isSaved ? 'active-star' : ''}" style="font-size: 1.5rem;" onclick="toggleEventFavorite('${ev.Event_ID}', this)">💖</button>
                            </div>
                        </div>
                        <p style="font-size:0.9rem; margin-top:5px;">${ev.Event_Description}</p>
                    </div>
                </div>
            `;
        });
        eventsHtml += `</div>`;
    }
    let openingHtml = '';
    if (venue.Opening_Days || venue.Opening_Open_Time) {
        openingHtml = `
            <div style="margin-bottom: 15px; color: var(--text-light); line-height: 1.5;">
                <strong style="color: #fff;">Hours:</strong> ${venue.Opening_Days || ''} ${venue.Opening_Open_Time || ''} - ${venue.Opening_Close_Time || ''}<br>
                ${venue.Opening_Notes ? `<em>${venue.Opening_Notes}</em>` : ''}
            </div>
            <hr style="border: 0; height: 1px; background: var(--bright-red-orange); margin: 15px 0;">
        `;
    }

    dynamicLayout.innerHTML = `
        <div class="modal-top-split">
            <div class="modal-left-col">
                <div class="modal-image-container">
                    <img id="modal-venue-image" class="venue-image centered-image" src="Venue_images/${venue.Venue_ID}-01.jpg" onerror="this.onerror=null; this.src='${PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)]}'" data-id="${venue.Venue_ID}" data-index="1" title="Tap for next image">
                </div>
                
                <div class="desktop-stats">
                    <div class="desktop-stats-container">
                        ${statsHtml}
                    </div>
                </div>
            </div>

            <div class="modal-right-col">
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; flex-direction: column;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="btn-map" class="btn secondary-btn pill-btn" style="padding: 2px 8px; font-size: 0.75rem; width: auto; flex-shrink: 0;">🗺️ Directions</button>
                        <p class="meta-text" style="margin:0; color:#fff;"><strong>${venue.Address || ''}</strong></p>
                    </div>
                    ${venue.Nearest_Station ? `<p class="meta-text" style="margin:0; padding-left: 5px; color:#fff;">🚄 Station: ${venue.Nearest_Station}</p>` : ''}
                </div>
                
                <div class="mobile-stats">
                    ${statsHtml}
                </div>
                
                ${ratingsTableHtml}
            </div>
        </div>
        
        <div class="full-width-about" style="background-color: var(--near-black); padding: 20px; border-radius: var(--radius-card); margin-bottom: 15px; margin-top: 15px;">
            <h3 class="display-font" style="color: var(--primary-blue); margin-bottom:10px;">ABOUT</h3>
            ${openingHtml}
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
        shareBtn.innerHTML = BR_ICONS.share;
        shareBtn.onclick = () => shareURL(`${window.location.origin}${window.location.pathname}?venue=${venue.Venue_ID}#venue=${venue.Venue_ID}`, venue.Name);
    }
    
    const reportBtn = document.getElementById('modal-report');
    if(reportBtn) {
        reportBtn.onclick = () => window.flagListing(venue.Venue_ID, venue.Name, 'Venue Report');
    }
    
    const mapBtn = document.getElementById('btn-map');
    if(mapBtn) {
        mapBtn.onclick = () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS && venue.Apple_Maps_URL && venue.Apple_Maps_URL.trim() !== '') {
                window.open(venue.Apple_Maps_URL, '_blank');
                return;
            } else if (!isIOS && venue.Google_Maps_URL && venue.Google_Maps_URL.trim() !== '') {
                window.open(venue.Google_Maps_URL, '_blank');
                return;
            }
            
            const mapQuery = venue.Native_Map_Query || venue.Address || venue.Name || '';
            const encodedQuery = encodeURIComponent(mapQuery.trim());
            if (isIOS) {
                window.open(`https://maps.apple.com/?q=${encodedQuery}`, '_blank');
            } else {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`, '_blank');
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
        window.location.hash = '#results';
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