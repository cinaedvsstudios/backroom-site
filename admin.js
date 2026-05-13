// Admin State
let liveData = [];
let draftData = [];
let currentMode = 'venues'; // 'venues' or 'events'
let lastSavedDate = localStorage.getItem('br_admin_timestamp') || 'Never';
let activeTableFilters = {}; 

const pinGate = document.getElementById('pin-gate');
const adminShell = document.getElementById('admin-shell');
const tableContainer = document.getElementById('admin-table-container');
const pinInput = document.getElementById('admin-pin');

// Keypad Logic
window.addPin = (num) => pinInput.value += num;
window.delPin = () => pinInput.value = pinInput.value.slice(0, -1);

document.getElementById('btn-login').addEventListener('click', () => {
    if (pinInput.value === '1234') {
        pinGate.classList.add('hidden');
        adminShell.classList.remove('hidden');
        loadDraftsFromLocal();
    } else {
        document.getElementById('pin-error').classList.remove('hidden');
        pinInput.value = '';
    }
});

// View Switching
window.switchView = function(view) {
    currentMode = view;
    document.getElementById('summary-title').innerText = view === 'venues' ? 'VENUE DATA' : 'EVENT DATA';
    activeTableFilters = {};
    renderFilters();
    renderTable();
}

// Data Handling
function loadDraftsFromLocal() {
    const vDraft = localStorage.getItem('br_admin_venues_draft');
    if(vDraft) draftData = JSON.parse(vDraft);
    document.getElementById('summary-timestamp').innerText = `Showing Data From: ${lastSavedDate}`;
    renderTable();
}

function saveDraftsToLocal() {
    lastSavedDate = new Date().toLocaleString();
    localStorage.setItem('br_admin_timestamp', lastSavedDate);
    if(currentMode === 'venues') localStorage.setItem('br_admin_venues_draft', JSON.stringify(draftData));
    else localStorage.setItem('br_admin_events_draft', JSON.stringify(draftData));
    document.getElementById('summary-timestamp').innerText = `Showing Data From: ${lastSavedDate}`;
    updateMismatchCount();
}

// Fetch Live
document.getElementById('btn-fetch-live').addEventListener('click', async () => {
    try {
        const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
        const res = await fetch(url);
        if(!res.ok) throw new Error("Could not find file.");
        liveData = await res.json();
        draftData = JSON.parse(JSON.stringify(liveData)); // clone to draft
        saveDraftsToLocal();
        renderTable();
        alert("Live data loaded and saved to local draft!");
    } catch(err) {
        alert(err.message + " Try Manual Upload.");
    }
});

// Manual Upload
document.getElementById('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            draftData = JSON.parse(event.target.result);
            saveDraftsToLocal();
            renderTable();
        } catch (err) { alert("Error parsing JSON."); }
    };
    reader.readAsText(file);
});

// Download All
document.getElementById('btn-download-all').addEventListener('click', () => {
    const vDraft = localStorage.getItem('br_admin_venues_draft') || '[]';
    const eDraft = localStorage.getItem('br_admin_events_draft') || '[]';
    
    const download = (dataStr, name) => {
        const blob = new Blob([dataStr], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
    };
    
    download(vDraft, 'listings.json');
    setTimeout(() => download(eDraft, 'events.json'), 500);
});

// Table Rendering & Filtering
function applyTableFilters() {
    return draftData.filter(row => {
        for(let col in activeTableFilters) {
            const rowVal = String(row[col] || '').toLowerCase();
            const filterVal = activeTableFilters[col].toLowerCase();
            if(!rowVal.includes(filterVal)) return false;
        }
        return true;
    });
}

window.removeFilter = function(col) {
    delete activeTableFilters[col];
    renderFilters();
    renderTable();
}

function renderFilters() {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';
    Object.keys(activeTableFilters).forEach(col => {
        container.innerHTML += `<div class="filter-pill">${col}: ${activeTableFilters[col]} <span onclick="removeFilter('${col}')">✕</span></div>`;
    });
}

function renderTable() {
    if (!draftData || draftData.length === 0) {
        tableContainer.innerHTML = "<p style='padding:20px;'>No data. Load a file first.</p>";
        updateMismatchCount();
        return;
    }

    const filteredData = applyTableFilters();
    const columns = Object.keys(draftData[0] || {});

    let html = `<table><thead><tr>
        <th>Edit</th>
        <th>Select</th>`;
        
    columns.forEach(col => {
        html += `<th>
            ${col}
            <input type="text" class="filter-header-input" placeholder="Filter..." data-col="${col}">
        </th>`;
    });
    
    html += `</tr></thead><tbody id="admin-tbody">`;
    
    filteredData.forEach((row, index) => {
        const id = row.Venue_ID || row.Event_ID || index;
        html += `<tr data-id="${id}">
            <td><button class="btn primary-btn pill-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="alert('Editor modal for ${id} opening...')">Edit Entry</button></td>
            <td style="text-align:center;"><input type="checkbox" style="transform:scale(1.5);"></td>`;
        
        columns.forEach(col => {
            html += `<td>${String(row[col] || '')}</td>`;
        });
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;

    // Attach Header Filter Listeners
    document.querySelectorAll('.filter-header-input').forEach(inp => {
        inp.addEventListener('keypress', (e) => {
            if(e.key === 'Enter' && e.target.value.trim() !== '') {
                activeTableFilters[e.target.dataset.col] = e.target.value.trim();
                e.target.value = '';
                renderFilters();
                renderTable();
            }
        });
    });

    updateMismatchCount();
}

// Mismatch Logic
function updateMismatchCount() {
    if(liveData.length === 0) {
        document.getElementById('summary-mismatch').innerText = "Live data not loaded for comparison.";
        document.getElementById('summary-mismatch').style.color = 'var(--text-light)';
        return;
    }
    
    let mismatchCount = 0;
    draftData.forEach(dRow => {
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const lRow = liveData.find(l => l[idField] === dRow[idField]);
        if(!lRow || JSON.stringify(lRow) !== JSON.stringify(dRow)) mismatchCount++;
    });
    
    const txt = document.getElementById('summary-mismatch');
    if(mismatchCount === 0) {
        txt.innerText = "All records match live data.";
        txt.style.color = "var(--primary-blue)";
    } else {
        txt.innerText = `${mismatchCount} / ${draftData.length} records do not match.`;
        txt.style.color = "var(--bright-red-orange)";
    }
}

document.getElementById('btn-highlight-changes').addEventListener('click', () => {
    if(liveData.length === 0) return alert("Load live data first to compare!");
    const tbody = document.getElementById('admin-tbody');
    if(!tbody) return;
    
    Array.from(tbody.children).forEach(tr => {
        const id = tr.dataset.id;
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const dRow = draftData.find(d => d[idField] === id);
        const lRow = liveData.find(l => l[idField] === id);
        
        if(!lRow || JSON.stringify(lRow) !== JSON.stringify(dRow)) {
            tr.classList.add('row-mismatch');
        } else {
            tr.classList.remove('row-mismatch');
        }
    });
});