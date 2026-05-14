let liveData = [];
let draftData = [];
let currentMode = 'venues'; // 'venues', 'events', 'editor', 'avatars'
let lastSavedDate = localStorage.getItem('br_admin_timestamp') || 'Never';
let activeTableFilters = {}; 

let avatarAdminData = [];
let tempMergeData = []; 

let editorHistory = [];
let historyIndex = -1;

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

let lastJsonErrorText = "";
function handleJSONError(err, fileText) {
    const modal = document.getElementById('json-error-modal');
    const details = document.getElementById('json-error-details');
    if(!modal || !details) return alert("JSON Error: " + err.message);
    
    let report = `Error: ${err.message}\n\n`;
    const match = err.message.match(/at position (\d+)/);
    if(match && fileText) {
        const pos = parseInt(match[1]);
        const start = Math.max(0, pos - 30);
        const end = Math.min(fileText.length, pos + 30);
        let snippet = fileText.substring(start, end);
        report += `--- Context Snippet (Near character ${pos}) ---\n`;
        report += `...${snippet}...\n`;
        report += `   ${' '.repeat(pos - start)}^ (Error roughly here)\n`;
    } else {
        report += `Could not extract character position.\n`;
    }
    
    lastJsonErrorText = report;
    details.innerText = report;
    modal.classList.remove('hidden');
}

window.addPin = function(num) {
    const pinInput = document.getElementById('admin-pin');
    if(pinInput && pinInput.value.length < 4) pinInput.value += num;
    window.checkPin();
};

window.delPin = function() {
    const pinInput = document.getElementById('admin-pin');
    if(pinInput) pinInput.value = pinInput.value.slice(0, -1);
};

window.checkPin = function() {
    const pinInput = document.getElementById('admin-pin');
    const pinGate = document.getElementById('pin-gate');
    const adminShell = document.getElementById('admin-shell');
    if (!pinInput || !pinGate || !adminShell) return;

    if (pinInput.value === '6997') {
        localStorage.setItem('br_admin_logged_in', 'true');
        pinGate.classList.add('hidden');
        adminShell.classList.remove('hidden');
        loadDraftsFromLocal();
    } else if (pinInput.value.length === 4) {
        const err = document.getElementById('pin-error');
        if(err) err.classList.remove('hidden');
        pinInput.value = '';
    }
};

window.switchView = function(view) {
    currentMode = view;
    const views = {
        'tables': document.getElementById('view-tables'),
        'editor': document.getElementById('view-editor'),
        'avatars': document.getElementById('view-avatars')
    };
    
    Object.keys(views).forEach(k => {
        if(views[k]) {
            views[k].style.display = 'none';
            views[k].classList.add('hidden');
        }
    });

    if(view === 'editor') {
        views['editor'].style.display = 'flex';
        views['editor'].classList.remove('hidden');
        saveEditorState(); 
    } else if (view === 'avatars') {
        views['avatars'].style.display = 'flex';
        views['avatars'].classList.remove('hidden');
        loadAdminAvatars();
    } else {
        views['tables'].style.display = 'flex';
        views['tables'].classList.remove('hidden');
        const title = document.getElementById('summary-title');
        if(title) title.innerText = view === 'venues' ? 'VENUE DATA' : 'EVENT DATA';
        activeTableFilters = {};
        loadDraftsFromLocal();
    }
};

function loadDraftsFromLocal() {
    if(currentMode !== 'venues' && currentMode !== 'events') return;
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    const draft = localStorage.getItem(draftKey);
    if(draft) draftData = JSON.parse(draft);
    else draftData = [];
    
    fetchLiveSilently();
    const timeDisplay = document.getElementById('summary-timestamp');
    if(timeDisplay) timeDisplay.innerText = `Showing Data From: ${lastSavedDate}`;
    renderFilters();
    renderTable();
    generateReviewLists();
}

function saveDraftsToLocal() {
    lastSavedDate = new Date().toLocaleString();
    localStorage.setItem('br_admin_timestamp', lastSavedDate);
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    const timeDisplay = document.getElementById('summary-timestamp');
    if(timeDisplay) timeDisplay.innerText = `Showing Data From: ${lastSavedDate}`;
    updateMismatchCount();
    generateReviewLists();
}

async function fetchLiveSilently() {
    try {
        const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
        const res = await fetch(url + '?v=' + new Date().getTime());
        if(res.ok) liveData = await res.json();
        updateMismatchCount();
        renderTable(); 
    } catch(e) {}
}

function generateReviewLists() {
    if(currentMode !== 'venues') {
        document.getElementById('sidebar-pending-list').innerHTML = '';
        document.getElementById('sidebar-old-list').innerHTML = '';
        return;
    }
    
    const pendingList = document.getElementById('sidebar-pending-list');
    const oldList = document.getElementById('sidebar-old-list');
    pendingList.innerHTML = ''; oldList.innerHTML = '';
    
    const now = new Date();
    
    draftData.forEach(row => {
        const name = row.Name || 'Unknown';
        const id = row.Venue_ID;
        
        if(!row.Share_URL || String(row.Share_URL).toLowerCase() === 'false' || String(row.Share_URL) === 'PENDING') {
            const div = document.createElement('div');
            div.innerText = `• ${name}`;
            div.onclick = () => jumpToRow(id);
            pendingList.appendChild(div);
        }
        
        if(row.Last_Updated) {
            const parts = row.Last_Updated.split('-'); 
            if(parts.length === 3) {
                const updatedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                const diffDays = Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24));
                if(diffDays > 30) {
                    const div = document.createElement('div');
                    div.innerText = `• ${name} (${diffDays}d)`;
                    div.onclick = () => jumpToRow(id);
                    oldList.appendChild(div);
                }
            }
        }
    });
}

window.jumpToRow = function(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if(tr) {
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tr.classList.remove('flash-row');
        void tr.offsetWidth; 
        tr.classList.add('flash-row');
    }
}

window.markReviewed = function(id) {
    const rowIndex = draftData.findIndex(d => d.Venue_ID === id || d.Event_ID === id);
    if(rowIndex >= 0) {
        draftData[rowIndex].Share_URL = true;
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        draftData[rowIndex].Last_Updated = `${dd}-${mm}-${yyyy}`;
        
        saveDraftsToLocal();
        renderTable();
        showToast("Marked as Reviewed!");
    }
}

window.removeFilter = function(col) {
    delete activeTableFilters[col];
    renderFilters();
    renderTable();
};

window.toggleColumn = function(idx) {
    const cols = document.querySelectorAll(`.col-idx-${idx}`);
    cols.forEach(c => c.classList.toggle('hidden-col'));
};

window.unhideAllColumns = function() {
    document.querySelectorAll('.hidden-col').forEach(c => c.classList.remove('hidden-col'));
};

const headerMapping = {
    "Event_Start_Time": "Start Time", "Event_End_Time": "End Time", "Venue_ID": "ID", "Event_ID": "ID",
    "Description": "Desc", "Event_Description": "Desc", "Rating_General": "Gen", "Rating_Darkroom": "Dark"
};

function renderFilters() {
    const container = document.getElementById('active-filters');
    if(!container) return;
    container.innerHTML = '';
    Object.keys(activeTableFilters).forEach(col => {
        container.innerHTML += `<div class="filter-pill">${col}: ${activeTableFilters[col]} <span onclick="removeFilter('${col}')">✕</span></div>`;
    });
}

function generateTableHTML(dataObj, isMainTable) {
    if (!dataObj || dataObj.length === 0) return "<p style='padding:20px;'>No data available.</p>";

    const columns = Object.keys(dataObj[0] || {});
    let html = `<table><thead><tr>`;
    
    if(!isMainTable) html += `<th style="min-width:40px;">🗑️</th>`; 
    if(isMainTable) html += `<th style="min-width:70px;">Review</th>`; 
        
    columns.forEach((col, idx) => {
        const displayName = headerMapping[col] || col;
        html += `<th class="col-idx-${idx}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="eye-btn" onclick="toggleColumn(${idx})" title="Toggle Hide">👁️</span>
                <span class="col-title" style="flex-grow:1;">${displayName}</span>
            </div>`;
        
        if(isMainTable) {
            // v0.38 - Dropdowns for specific filter fields
            if (col === 'Status') {
                html += `<select class="filter-header-select filter-dropdown" data-col="${col}"><option value="">Filter...</option><option value="Live">Live</option><option value="Closed">Closed</option><option value="Hold">Hold</option><option value="Flag">Flag</option></select>`;
            } else if (col.startsWith('Feature_')) {
                html += `<select class="filter-header-select filter-dropdown" data-col="${col}"><option value="">Filter...</option><option value="true">True</option><option value="false">False</option></select>`;
            } else if (col.startsWith('Rating_')) {
                html += `<select class="filter-header-select filter-dropdown" data-col="${col}"><option value="">Filter...</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>`;
            } else {
                html += `<input type="text" class="filter-header-input" placeholder="Filter..." data-col="${col}">`;
            }
        }
        html += `</th>`;
    });
    
    html += `</tr></thead><tbody ${isMainTable ? 'id="admin-tbody"' : ''}>`;
    
    dataObj.forEach((row, rowIndex) => {
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const id = row[idField] || rowIndex;
        
        let isNew = false;
        if(isMainTable && liveData.length > 0) {
            isNew = !liveData.some(l => l[idField] === id);
        }

        html += `<tr data-id="${id}" class="${isNew ? 'new-entry-row' : ''}" ${!isMainTable ? `id="preview-row-${rowIndex}"` : ''}>`;
        
        if(!isMainTable) {
            html += `<td style="text-align:center; cursor:pointer;" onclick="removePreviewRow(${rowIndex})">🗑️</td>`;
        }
        if(isMainTable) {
            const needsReview = (!row.Share_URL || String(row.Share_URL) === 'false' || String(row.Share_URL) === 'PENDING');
            html += `<td style="text-align:center;">
                ${needsReview ? `<button onclick="markReviewed('${id}')" style="background:var(--primary-blue); border:none; color:#fff; border-radius:4px; cursor:pointer; padding:2px 5px;" title="Mark Reviewed">✔️</button>` : ''}
                ${isNew ? `<br><span class="new-badge">NEW</span>` : ''}
            </td>`;
        }
        
        columns.forEach((col, idx) => {
            let isEdited = false;
            if (isMainTable && liveData.length > 0 && !isNew) {
                const lRow = liveData.find(l => l[idField] === row[idField]);
                if (lRow && String(lRow[col]) !== String(row[col])) isEdited = true;
            }
            
            const editedClass = isEdited ? 'edited-cell' : '';
            if(isMainTable) {
                html += `<td class="col-idx-${idx} ${editedClass}" onclick="editCell(this, ${rowIndex}, '${col}')">${String(row[col] || '')}</td>`;
            } else {
                html += `<td class="col-idx-${idx} preview-editable-cell" contenteditable="true" onblur="updatePreviewData(${rowIndex}, '${col}', this)">${String(row[col] || '')}</td>`;
            }
        });
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    return html;
}

function renderTable() {
    const tableContainer = document.getElementById('admin-table-container');
    if(!tableContainer) return;
    if (!draftData || draftData.length === 0) {
        tableContainer.innerHTML = "<p style='padding:20px;'>No data. Load a file first.</p>";
        updateMismatchCount();
        return;
    }

    const filteredData = draftData.filter(row => {
        for(let col in activeTableFilters) {
            const rowVal = String(row[col] || '').toLowerCase();
            const filterVal = activeTableFilters[col].toLowerCase();
            if(!rowVal.includes(filterVal)) return false;
        }
        return true;
    });

    tableContainer.innerHTML = generateTableHTML(filteredData, true);

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
    
    document.querySelectorAll('.filter-header-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            if(e.target.value !== '') {
                activeTableFilters[e.target.dataset.col] = e.target.value;
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
    
    const currentVal = td.innerText.trim();
    
    if(col === 'Status' || col.startsWith('Feature_') || col.startsWith('Rating_')) {
        let options = '';
        if(col === 'Status') options = '<option value="Live">Live</option><option value="Closed">Closed</option><option value="Hold">Hold</option><option value="Flag">Flag</option>';
        else if(col.startsWith('Feature_')) options = '<option value="true">true</option><option value="false">false</option>';
        else if(col.startsWith('Rating_')) options = '<option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>';
        
        td.innerHTML = `<select class="cell-edit" onblur="saveCell(this, ${rowIndex}, '${col}')" onchange="saveCell(this, ${rowIndex}, '${col}')">${options}</select>`;
        td.querySelector('select').value = currentVal;
        td.querySelector('select').focus();
    } else {
        if (td.isContentEditable) return; 
        td.contentEditable = "true";
        td.focus();
        
        if(!td.dataset.listening) {
            td.addEventListener('blur', function() {
                td.contentEditable = "false";
                const newVal = td.innerText.trim();
                if(String(draftData[rowIndex][col]) !== newVal) {
                    draftData[rowIndex][col] = newVal;
                    td.classList.add('edited-cell');
                    saveDraftsToLocal();
                }
            });
            td.addEventListener('keydown', function(e) { if(e.key === 'Enter') { e.preventDefault(); td.blur(); } });
            td.dataset.listening = "true";
        }
    }
};

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
};

let currentMismatchIds = [];
function updateMismatchCount() {
    if(liveData.length === 0) {
        const mismatchEl = document.getElementById('summary-mismatch');
        if(mismatchEl) { mismatchEl.innerText = "Live data not loaded."; mismatchEl.style.color = 'var(--text-light)'; }
        return;
    }
    currentMismatchIds = [];
    draftData.forEach(dRow => {
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        const lRow = liveData.find(l => l[idField] === dRow[idField]);
        if(!lRow || JSON.stringify(lRow) !== JSON.stringify(dRow)) currentMismatchIds.push(dRow[idField]);
    });
    
    const txt = document.getElementById('summary-mismatch');
    if(txt) {
        if(currentMismatchIds.length === 0) { txt.innerText = "All records match live data."; txt.style.color = "var(--primary-blue)"; } 
        else { txt.innerText = `${currentMismatchIds.length} records do not match.`; txt.style.color = "var(--bright-red-orange)"; }
    }
}

window.removePreviewRow = function(idx) {
    tempMergeData[idx] = null; 
    document.getElementById(`preview-row-${idx}`).style.display = 'none';
}
window.updatePreviewData = function(idx, col, el) {
    if(tempMergeData[idx]) tempMergeData[idx][col] = el.innerText.trim();
}

async function loadAdminAvatars() {
    try {
        const res = await fetch('Profile_images/avatar_list.json?v=' + Date.now());
        if(res.ok) avatarAdminData = await res.json();
        else avatarAdminData = [];
    } catch(e) { avatarAdminData = []; }
    renderAdminAvatars();
}


// =================== part 2 ================


function renderAdminAvatars() {
    const list = document.getElementById('avatar-manager-list');
    if(!list) return;
    list.innerHTML = '';
    
    avatarAdminData.forEach((av, idx) => {
        const row = document.createElement('div');
        row.className = 'avatar-admin-row';
        row.innerHTML = `
            <img src="Profile_images/${av.file}" onerror="this.src='placeholder_venue.jpg'">
            <input type="text" value="${av.label}" onblur="updateAvatarLabel(${idx}, this.value)" placeholder="Label">
            <select onchange="updateAvatarCat(${idx}, this.value)">
                <option value="Young" ${av.category === 'Young' ? 'selected' : ''}>Young</option>
                <option value="Prime" ${av.category === 'Prime' ? 'selected' : ''}>Prime</option>
                <option value="Mature" ${av.category === 'Mature' ? 'selected' : ''}>Mature</option>
            </select>
            <div class="up-down-btns">
                <button onclick="moveAvatar(${idx}, -1)">▲</button>
                <button onclick="moveAvatar(${idx}, 1)">▼</button>
            </div>
            <button class="btn" style="background:var(--dark-red); color:#fff; padding:5px;" onclick="deleteAvatar(${idx})">❌</button>
        `;
        list.appendChild(row);
    });
}

window.updateAvatarLabel = (idx, val) => { avatarAdminData[idx].label = val; }
window.updateAvatarCat = (idx, val) => { avatarAdminData[idx].category = val; }
window.moveAvatar = (idx, dir) => {
    if(idx + dir < 0 || idx + dir >= avatarAdminData.length) return;
    const temp = avatarAdminData[idx];
    avatarAdminData[idx] = avatarAdminData[idx + dir];
    avatarAdminData[idx + dir] = temp;
    renderAdminAvatars();
}
window.deleteAvatar = (idx) => {
    avatarAdminData.splice(idx, 1);
    renderAdminAvatars();
}

document.getElementById('btn-add-avatar')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) {
        const name = file.name;
        avatarAdminData.push({ file: name, label: "New Avatar", category: "Prime" });
        renderAdminAvatars();
        e.target.value = '';
    }
});

document.getElementById('btn-download-avatars')?.addEventListener('click', () => {
    const dataStr = JSON.stringify(avatarAdminData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `avatar_list.json`;
    a.click();
    showToast("Downloaded avatar_list.json");
});

const wysiwygContent = document.getElementById('wysiwyg-content');
const wysiwygSource = document.getElementById('wysiwyg-source');

function saveEditorState() {
    if(!wysiwygContent) return;
    historyIndex++;
    editorHistory.splice(historyIndex);
    editorHistory.push(wysiwygContent.innerHTML);
    if(editorHistory.length > 50) { editorHistory.shift(); historyIndex--; }
}

wysiwygContent?.addEventListener('input', () => {
    clearTimeout(window.editorSaveTimer);
    window.editorSaveTimer = setTimeout(saveEditorState, 500);
});

// v0.38 Fix - Ensure content editor has focus before formatting
window.editorAction = function(action, val, event) {
    if(event) event.preventDefault(); 
    if(wysiwygSource && !wysiwygSource.classList.contains('hidden')) return alert("Switch to Visual Editor first.");
    
    wysiwygContent.focus(); 
    
    if(action === 'undo') {
        if(historyIndex > 0) { historyIndex--; wysiwygContent.innerHTML = editorHistory[historyIndex]; }
    } else if(action === 'redo') {
        if(historyIndex < editorHistory.length - 1) { historyIndex++; wysiwygContent.innerHTML = editorHistory[historyIndex]; }
    } else if(action === 'normal') {
        document.execCommand('removeFormat', false, null);
    } else if(action === 'h1') {
        document.execCommand('insertHTML', false, `<span style="font-size: 2.2rem; font-family: 'Antonio', sans-serif; color: var(--primary-blue); font-weight: bold; text-transform: uppercase;">${window.getSelection().toString()}</span>`);
    } else if(action === 'h2') {
        document.execCommand('insertHTML', false, `<span style="font-size: 1.6rem; font-family: 'Antonio', sans-serif; color: var(--primary-blue); font-weight: bold; text-transform: uppercase;">${window.getSelection().toString()}</span>`);
    } else if(action === 'bold') {
        document.execCommand('bold', false, null);
    } else if(action === 'color') {
        document.execCommand('foreColor', false, val);
    } else if(action === 'insertTable') {
        document.execCommand('insertHTML', false, '<table border="1" style="width:100%; border-collapse:collapse; margin: 15px 0;"><tr><td style="padding:8px;">Cell</td><td style="padding:8px;">Cell</td></tr><tr><td style="padding:8px;">Cell</td><td style="padding:8px;">Cell</td></tr></table><p><br></p>');
    } else if(['addRow', 'addCol', 'deleteRow', 'deleteCol'].includes(action)) {
        handleTableAction(action);
    }
    saveEditorState();
}

document.querySelectorAll('.editor-toolbar button').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
        if(e.target.tagName === 'BUTTON') e.preventDefault(); 
    });
});

function handleTableAction(action) {
    const sel = window.getSelection();
    if(!sel.rangeCount) return;
    let node = sel.anchorNode;
    let td = null, tr = null, table = null;
    
    while(node && node !== wysiwygContent) {
        if(node.nodeName === 'TD') td = node;
        if(node.nodeName === 'TR') tr = node;
        if(node.nodeName === 'TABLE') table = node;
        node = node.parentNode;
    }
    if(!table || !tr || !td) return alert("Place cursor inside a table cell first.");
    
    const cellIndex = Array.from(tr.children).indexOf(td);
    
    if(action === 'addRow') {
        const newTr = table.insertRow(tr.rowIndex + 1);
        for(let i=0; i<tr.cells.length; i++) newTr.insertCell(i).innerHTML = 'New';
    } else if(action === 'addCol') {
        Array.from(table.rows).forEach(r => r.insertCell(cellIndex + 1).innerHTML = 'New');
    } else if(action === 'deleteRow') {
        table.deleteRow(tr.rowIndex);
    } else if(action === 'deleteCol') {
        Array.from(table.rows).forEach(r => { if(r.cells[cellIndex]) r.deleteCell(cellIndex); });
    }
}

window.toggleEditorSource = function() {
    const btn = document.getElementById('btn-toggle-source');
    if(wysiwygSource.classList.contains('hidden')) {
        wysiwygSource.value = wysiwygContent.innerHTML;
        wysiwygContent.classList.add('hidden');
        wysiwygSource.classList.remove('hidden');
        btn.innerText = '👁️ Visual Editor';
    } else {
        wysiwygContent.innerHTML = wysiwygSource.value;
        wysiwygSource.classList.add('hidden');
        wysiwygContent.classList.remove('hidden');
        btn.innerText = '👁️ View Source';
        saveEditorState();
    }
}

window.downloadEditorHTML = function() {
    const content = wysiwygSource.classList.contains('hidden') ? wysiwygContent.innerHTML : wysiwygSource.value;
    const select = document.getElementById('editor-page-select');
    const blob = new Blob([content], {type: 'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backroom_${select.value}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
}

document.addEventListener('DOMContentLoaded', () => {
    const pinGate = document.getElementById('pin-gate');
    const adminShell = document.getElementById('admin-shell');
    const btnLogin = document.getElementById('btn-login');

    if(localStorage.getItem('br_admin_logged_in') === 'true') {
        if(pinGate) pinGate.classList.add('hidden');
        if(adminShell) adminShell.classList.remove('hidden');
        loadDraftsFromLocal();
    }
    if(btnLogin) btnLogin.addEventListener('click', window.checkPin);

    document.getElementById('nav-venues')?.addEventListener('click', () => switchView('venues'));
    document.getElementById('nav-events')?.addEventListener('click', () => switchView('events'));
    document.getElementById('nav-editor')?.addEventListener('click', () => switchView('editor'));
    document.getElementById('nav-avatars')?.addEventListener('click', () => switchView('avatars'));

    document.getElementById('btn-sidebar-pending')?.addEventListener('click', () => {
        document.getElementById('sidebar-pending-list').classList.toggle('hidden');
    });
    document.getElementById('btn-sidebar-old')?.addEventListener('click', () => {
        document.getElementById('sidebar-old-list').classList.toggle('hidden');
    });

    const makeDraggable = (headerId, windowId) => {
        const header = document.getElementById(headerId);
        const win = document.getElementById(windowId);
        if(!header || !win) return;
        let isDragging = false, startX, startY, initialLeft, initialTop;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true; startX = e.clientX; startY = e.clientY;
            const rect = win.getBoundingClientRect(); win.style.transform = 'none';
            initialLeft = rect.left; initialTop = rect.top;
            win.style.left = initialLeft + 'px'; win.style.top = initialTop + 'px';
        });
        document.addEventListener('mousemove', (e) => {
            if(isDragging) { win.style.left = (initialLeft + e.clientX - startX) + 'px'; win.style.top = (initialTop + e.clientY - startY) + 'px'; }
        });
        document.addEventListener('mouseup', () => isDragging = false);
    };

    makeDraggable('clipboard-header', 'clipboard-float');
    makeDraggable('preview-import-header', 'preview-import-modal');

    const clipboard = document.getElementById('clipboard-text');
    if(clipboard) {
        clipboard.value = localStorage.getItem('br_admin_clipboard') || '';
        clipboard.addEventListener('input', (e) => localStorage.setItem('br_admin_clipboard', e.target.value));
    }

    document.getElementById('btn-fetch-live')?.addEventListener('click', async () => {
        try {
            const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
            const res = await fetch(url + '?v=' + new Date().getTime());
            if(!res.ok) throw new Error("Could not find file.");
            liveData = await res.json();
            draftData = JSON.parse(JSON.stringify(liveData)); 
            saveDraftsToLocal();
            renderTable();
            showToast(`Live data loaded / Changes cleared!`);
        } catch(err) { showToast("Fetch failed."); }
    });

    document.getElementById('file-upload-replace')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                draftData = JSON.parse(event.target.result);
                saveDraftsToLocal();
                renderTable();
                showToast("Data replaced successfully!");
            } catch (err) { handleJSONError(err, event.target.result); }
        };
        reader.readAsText(file);
    });

    let isMergeAction = false;
    
    document.getElementById('file-upload-merge')?.addEventListener('change', (e) => {
        isMergeAction = true;
        triggerPreviewRead(e.target.files[0]);
        e.target.value = '';
    });
    
    document.getElementById('file-preview-import')?.addEventListener('change', (e) => {
        isMergeAction = false;
        triggerPreviewRead(e.target.files[0]);
        e.target.value = '';
    });

    function triggerPreviewRead(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            try {
                tempMergeData = JSON.parse(text);
                if(!Array.isArray(tempMergeData)) throw new Error("File is not an array");
                
                document.getElementById('preview-table-container').innerHTML = generateTableHTML(tempMergeData, false);
                document.getElementById('preview-modal-title').innerText = isMergeAction ? "👁️ REVIEW & MERGE IMPORT" : "👁️ PREVIEW DATA";
                
                const btnApply = document.getElementById('btn-apply-merge');
                if(isMergeAction) btnApply.classList.remove('hidden');
                else btnApply.classList.add('hidden');
                
                document.getElementById('preview-import-modal').classList.remove('hidden');
            } catch (err) { handleJSONError(err, text); }
        };
        reader.readAsText(file);
    }

    document.getElementById('btn-apply-merge')?.addEventListener('click', () => {
        const validMergeData = tempMergeData.filter(d => d !== null);
        const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
        let mCount = 0, aCount = 0;
        
        validMergeData.forEach(newRow => {
            const existingIdx = draftData.findIndex(d => d[idField] === newRow[idField]);
            if(existingIdx >= 0) { draftData[existingIdx] = { ...draftData[existingIdx], ...newRow }; mCount++; } 
            else { draftData.push(newRow); aCount++; }
        });
        
        saveDraftsToLocal();
        renderTable();
        document.getElementById('preview-import-modal').classList.add('hidden');
        showToast(`Merge Applied: ${mCount} updated, ${aCount} new.`);
    });

    document.getElementById('btn-copy-error')?.addEventListener('click', () => { navigator.clipboard.writeText(lastJsonErrorText); showToast("Copied"); });
    document.getElementById('btn-export-csv')?.addEventListener('click', () => { /* Reserved for CSV Logic */ });
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
        const dataStr = JSON.stringify(draftData, null, 2);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([dataStr], {type: 'application/json'}));
        a.download = `backroom_${currentMode}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });
    
    document.getElementById('btn-download-all')?.addEventListener('click', () => {
        const v = localStorage.getItem('br_admin_venues_draft');
        const e = localStorage.getItem('br_admin_events_draft');
        if(v) { let a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([v])); a.download='listings.json'; a.click(); }
        if(e) setTimeout(()=> { let a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([e])); a.download='events.json'; a.click(); }, 500);
    });

    document.getElementById('summary-mismatch')?.addEventListener('click', () => {
        if(currentMismatchIds.length === 0) return;
        const list = document.getElementById('mismatch-list');
        list.innerHTML = '';
        // v0.38 - Make mismatch items clickable to jump straight to the row
        currentMismatchIds.forEach(id => {
            list.innerHTML += `<li style="color:var(--bright-red-orange); font-weight:bold; cursor:pointer; padding:4px 0; text-decoration:underline;" 
                onclick="document.getElementById('mismatch-modal').classList.add('hidden'); jumpToRow('${id}')">${id}</li>`;
        });
        document.getElementById('mismatch-modal').classList.remove('hidden');
    });

    document.getElementById('btn-highlight-changes')?.addEventListener('click', () => {
        if(liveData.length===0) return alert("Load live data!");
        Array.from(document.getElementById('admin-tbody').children).forEach(tr => {
            if(currentMismatchIds.includes(tr.dataset.id)) tr.classList.add('row-mismatch');
            else tr.classList.remove('row-mismatch');
        });
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal')?.classList.add('hidden')));
});