let liveData = [];
let draftData = [];
let currentMode = 'venues'; 
let lastSavedDate = localStorage.getItem('br_admin_timestamp') || 'Never';
let activeTableFilters = {}; 

const pinGate = document.getElementById('pin-gate');
const adminShell = document.getElementById('admin-shell');
const tableContainer = document.getElementById('admin-table-container');
const pinInput = document.getElementById('admin-pin');

if(localStorage.getItem('br_admin_logged_in') === 'true') {
    pinGate.classList.add('hidden');
    adminShell.classList.remove('hidden');
    loadDraftsFromLocal();
}

// Draggable Clipboard Logic
const clipboardFloat = document.getElementById('clipboard-float');
const clipHeader = document.getElementById('clipboard-header');
let isDragging = false, initialX, initialY, startX, startY;

clipHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = clipboardFloat.getBoundingClientRect();
    initialX = rect.left; initialY = rect.top;
    clipboardFloat.style.bottom = 'auto'; 
    clipboardFloat.style.right = 'auto';
    clipboardFloat.style.left = initialX + 'px';
    clipboardFloat.style.top = initialY + 'px';
});

document.addEventListener('mousemove', (e) => {
    if(isDragging) {
        clipboardFloat.style.left = (initialX + e.clientX - startX) + 'px';
        clipboardFloat.style.top = (initialY + e.clientY - startY) + 'px';
    }
});
document.addEventListener('mouseup', () => isDragging = false);

const clipboard = document.getElementById('clipboard-text');
clipboard.value = localStorage.getItem('br_admin_clipboard') || '';
clipboard.addEventListener('input', (e) => {
    localStorage.setItem('br_admin_clipboard', e.target.value);
});

// Keypad & Global Keyboard Logic
window.addPin = (num) => {
    if(pinInput.value.length < 4) pinInput.value += num;
    checkPin();
};
window.delPin = () => pinInput.value = pinInput.value.slice(0, -1);

document.addEventListener('keydown', (e) => {
    if (!pinGate.classList.contains('hidden')) {
        if (/^[0-9]$/.test(e.key) && pinInput.value.length < 4) {
            pinInput.value += e.key;
            checkPin();
        } else if (e.key === 'Backspace') {
            delPin();
        } else if (e.key === 'Enter') {
            checkPin();
        }
    }
});

document.getElementById('btn-login').addEventListener('click', checkPin);

function checkPin() {
    if (pinInput.value === '6997') {
        localStorage.setItem('br_admin_logged_in', 'true');
        pinGate.classList.add('hidden');
        adminShell.classList.remove('hidden');
        loadDraftsFromLocal();
    } else if (pinInput.value.length === 4) {
        document.getElementById('pin-error').classList.remove('hidden');
        pinInput.value = '';
    }
}

window.switchView = function(view) {
    currentMode = view;
    document.getElementById('summary-title').innerText = view === 'venues' ? 'VENUE DATA' : 'EVENT DATA';
    activeTableFilters = {};
    loadDraftsFromLocal();
}

function loadDraftsFromLocal() {
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    const draft = localStorage.getItem(draftKey);
    if(draft) draftData = JSON.parse(draft);
    else draftData = [];
    
    fetchLiveSilently();
    document.getElementById('summary-timestamp').innerText = `Showing Data From: ${lastSavedDate}`;
    renderFilters();
    renderTable();
}

function saveDraftsToLocal() {
    lastSavedDate = new Date().toLocaleString();
    localStorage.setItem('br_admin_timestamp', lastSavedDate);
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    document.getElementById('summary-timestamp').innerText = `Showing Data From: ${lastSavedDate}`;
    updateMismatchCount();
}

async function fetchLiveSilently() {
    try {
        const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
        const res = await fetch(url);
        if(res.ok) liveData = await res.json();
        updateMismatchCount();
    } catch(e) {}
}

document.getElementById('btn-fetch-live').addEventListener('click', async () => {
    try {
        const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
        const res = await fetch(url);
        if(!res.ok) throw new Error("Could not find file.");
        liveData = await res.json();
        draftData = JSON.parse(JSON.stringify(liveData)); 
        saveDraftsToLocal();
        renderTable();
        alert(`Live ${currentMode} data loaded and saved to local draft!`);
    } catch(err) {
        alert(err.message + " Try Manual Upload.");
    }
});

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

document.getElementById('btn-download-all').addEventListener('click', () => {
    const vDraft = localStorage.getItem('br_admin_venues_draft');
    const eDraft = localStorage.getItem('br_admin_events_draft');
    
    const download = (dataStr, name) => {
        if(!dataStr) return;
        const blob = new Blob([dataStr], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
    };
    
    if(vDraft) download(vDraft, 'listings.json');
    if(eDraft) setTimeout(() => download(eDraft, 'events.json'), 500);
});

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

window.toggleColumn = function(idx) {
    const th = document.querySelector(`th.col-idx-${idx}`);
    if(th) th.classList.toggle('hidden-col');
}

window.unhideAllColumns = function() {
    document.querySelectorAll('.hidden-col').forEach(c => c.classList.remove('hidden-col'));
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
        <th style="min-width:60px;">Edit</th>`;
        
    columns.forEach((col, idx) => {
        html += `<th class="col-idx-${idx}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="eye-btn" onclick="toggleColumn(${idx})" title="Toggle Hide">👁️</span>
                <span class="col-title" style="flex-grow:1;">${col}</span>
            </div>
            <input type="text" class="filter-header-input" placeholder="Filter..." data-col="${col}">
        </th>`;
    });
    
    html += `</tr></thead><tbody id="admin-tbody">`;
    
    filteredData.forEach((row, rowIndex) => {
        const id = row.Venue_ID || row.Event_ID || rowIndex;
        html += `<tr data-id="${id}">
            <td style="text-align:center; font-size:1.5rem;" onclick="alert('WYSIWYG Editor modal coming in Phase 2!')">✏️</td>`;
        
        columns.forEach((col, idx) => {
            const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
            let isEdited = false;
            if (liveData.length > 0) {
                const lRow = liveData.find(l => l[idField] === row[idField]);
                if (lRow && String(lRow[col]) !== String(row[col])) isEdited = true;
            }
            
            const editedClass = isEdited ? 'edited-cell' : '';
            html += `<td class="${editedClass}" onclick="editCell(this, ${rowIndex}, '${col}')">${String(row[col] || '')}</td>`;
        });
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;

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

window.editCell = function(td, rowIndex, col) {
    if(col === 'Venue_ID' || col === 'Event_ID') return; 
    if(td.querySelector('select')) return; 
    
    const currentVal = td.innerText;
    
    if(col === 'Status' || col.startsWith('Feature_') || col.startsWith('Rating_')) {
        let options = '';
        if(col === 'Status') options = '<option value="Live">Live</option><option value="Closed">Closed</option><option value="Hold">Hold</option><option value="Flag">Flag</option>';
        else if(col.startsWith('Feature_')) options = '<option value="true">true</option><option value="false">false</option>';
        else if(col.startsWith('Rating_')) options = '<option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>';
        
        td.innerHTML = `<select class="cell-edit" onblur="saveCell(this, ${rowIndex}, '${col}')" onchange="saveCell(this, ${rowIndex}, '${col}')">${options}</select>`;
        td.querySelector('select').value = currentVal;
        td.querySelector('select').focus();
    } else {
        const newVal = prompt(`Edit ${col}:`, currentVal);
        if(newVal !== null && newVal !== currentVal) {
            draftData[rowIndex][col] = newVal;
            td.innerText = newVal;
            td.classList.add('edited-cell');
            saveDraftsToLocal();
        }
    }
}

window.saveCell = function(selectEl, rowIndex, col) {
    const newVal = selectEl.value;
    let finalVal = newVal;
    if(newVal === 'true') finalVal = true;
    if(newVal === 'false') finalVal = false;
    if(col.startsWith('Rating_')) finalVal = parseInt(newVal);

    draftData[rowIndex][col] = finalVal;
    selectEl.parentElement.innerText = newVal;
    selectEl.parentElement.classList.add('edited-cell');
    saveDraftsToLocal();
    renderTable(); 
}

let currentMismatchIds = [];

function updateMismatchCount() {
    if(liveData.length === 0) {
        document.getElementById('summary-mismatch').innerText = "Live data not loaded for comparison.";
        document.getElementById('summary-mismatch').style.color = 'var(--text-light)';
        return;
    }
    
    currentMismatchIds = [];
    draftData.forEach(dRow => {
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const lRow = liveData.find(l => l[idField] === dRow[idField]);
        if(!lRow || JSON.stringify(lRow) !== JSON.stringify(dRow)) {
            currentMismatchIds.push(dRow[idField]);
        }
    });
    
    const txt = document.getElementById('summary-mismatch');
    if(currentMismatchIds.length === 0) {
        txt.innerText = "All records match live data.";
        txt.style.color = "var(--primary-blue)";
    } else {
        txt.innerText = `${currentMismatchIds.length} / ${draftData.length} records do not match.`;
        txt.style.color = "var(--bright-red-orange)";
    }
}

document.getElementById('summary-mismatch').addEventListener('click', () => {
    if(currentMismatchIds.length === 0) return;
    const list = document.getElementById('mismatch-list');
    list.innerHTML = '';
    currentMismatchIds.forEach(id => {
        list.innerHTML += `<li style="color:var(--bright-red-orange); font-weight:bold;">${id}</li>`;
    });
    document.getElementById('mismatch-modal').classList.remove('hidden');
});

document.getElementById('btn-highlight-changes').addEventListener('click', () => {
    if(liveData.length === 0) return alert("Load live data first to compare!");
    const tbody = document.getElementById('admin-tbody');
    if(!tbody) return;
    
    Array.from(tbody.children).forEach(tr => {
        const id = tr.dataset.id;
        if(currentMismatchIds.includes(id)) {
            tr.classList.add('row-mismatch');
        } else {
            tr.classList.remove('row-mismatch');
        }
    });
});

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
});