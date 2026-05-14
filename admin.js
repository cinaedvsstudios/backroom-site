let liveData = [];
let draftData = [];
let currentMode = 'venues'; 
let lastSavedDate = localStorage.getItem('br_admin_timestamp') || 'Never';
let activeTableFilters = {}; 

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

// Global functions required for inline HTML calls
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
    const title = document.getElementById('summary-title');
    if(title) title.innerText = view === 'venues' ? 'VENUE DATA' : 'EVENT DATA';
    activeTableFilters = {};
    loadDraftsFromLocal();
};

function loadDraftsFromLocal() {
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    const draft = localStorage.getItem(draftKey);
    if(draft) draftData = JSON.parse(draft);
    else draftData = [];
    
    fetchLiveSilently();
    const timeDisplay = document.getElementById('summary-timestamp');
    if(timeDisplay) timeDisplay.innerText = `Showing Data From: ${lastSavedDate}`;
    renderFilters();
    renderTable();
}

function saveDraftsToLocal() {
    lastSavedDate = new Date().toLocaleString();
    localStorage.setItem('br_admin_timestamp', lastSavedDate);
    const draftKey = currentMode === 'venues' ? 'br_admin_venues_draft' : 'br_admin_events_draft';
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    const timeDisplay = document.getElementById('summary-timestamp');
    if(timeDisplay) timeDisplay.innerText = `Showing Data From: ${lastSavedDate}`;
    updateMismatchCount();
}

async function fetchLiveSilently() {
    try {
        const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
        const res = await fetch(url + '?v=' + new Date().getTime());
        if(res.ok) liveData = await res.json();
        updateMismatchCount();
    } catch(e) {}
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
    "Event_Start_Time": "Start Time",
    "Event_End_Time": "End Time",
    "Venue_ID": "ID",
    "Event_ID": "ID",
    "Description": "Desc",
    "Event_Description": "Desc",
    "Rating_General": "Gen",
    "Rating_Darkroom": "Dark",
    "Feature_Men_Only": "Men Only",
    "Feature_Darkroom": "Darkroom"
};

function renderFilters() {
    const container = document.getElementById('active-filters');
    if(!container) return;
    container.innerHTML = '';
    Object.keys(activeTableFilters).forEach(col => {
        container.innerHTML += `<div class="filter-pill">${col}: ${activeTableFilters[col]} <span onclick="removeFilter('${col}')">✕</span></div>`;
    });
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

    const columns = Object.keys(draftData[0] || {});

    let html = `<table><thead><tr><th style="min-width:60px;">Edit</th>`;
        
    columns.forEach((col, idx) => {
        const displayName = headerMapping[col] || col;
        html += `<th class="col-idx-${idx}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="eye-btn" onclick="toggleColumn(${idx})" title="Toggle Hide">👁️</span>
                <span class="col-title" style="flex-grow:1;">${displayName}</span>
            </div>
            <input type="text" class="filter-header-input" placeholder="Filter..." data-col="${col}">
        </th>`;
    });
    
    html += `</tr></thead><tbody id="admin-tbody">`;
    
    filteredData.forEach((row, rowIndex) => {
        const id = row.Venue_ID || row.Event_ID || rowIndex;
        html += `<tr data-id="${id}">
            <td style="text-align:center; font-size:1.5rem;" onclick="alert('Phase 3 WYSIWYG Editor modal coming soon!')">✏️</td>`;
        
        columns.forEach((col, idx) => {
            const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
            let isEdited = false;
            if (liveData.length > 0) {
                const lRow = liveData.find(l => l[idField] === row[idField]);
                if (lRow && String(lRow[col]) !== String(row[col])) isEdited = true;
            }
            
            const editedClass = isEdited ? 'edited-cell' : '';
            html += `<td class="col-idx-${idx} ${editedClass}" onclick="editCell(this, ${rowIndex}, '${col}')">${String(row[col] || '')}</td>`;
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
                    updateMismatchCount();
                }
            });
            td.addEventListener('keydown', function(e) {
                if(e.key === 'Enter') {
                    e.preventDefault();
                    td.blur(); 
                }
            });
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
    updateMismatchCount();
};

let currentMismatchIds = [];

function updateMismatchCount() {
    if(liveData.length === 0) {
        const mismatchEl = document.getElementById('summary-mismatch');
        if(mismatchEl) {
            mismatchEl.innerText = "Live data not loaded for comparison.";
            mismatchEl.style.color = 'var(--text-light)';
        }
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
    if(txt) {
        if(currentMismatchIds.length === 0) {
            txt.innerText = "All records match live data.";
            txt.style.color = "var(--primary-blue)";
        } else {
            txt.innerText = `${currentMismatchIds.length} / ${draftData.length} records do not match.`;
            txt.style.color = "var(--bright-red-orange)";
        }
    }
}

// Initialization and DOM Element Binding
document.addEventListener('DOMContentLoaded', () => {
    const pinGate = document.getElementById('pin-gate');
    const adminShell = document.getElementById('admin-shell');
    const pinInput = document.getElementById('admin-pin');
    const btnLogin = document.getElementById('btn-login');

    if(localStorage.getItem('br_admin_logged_in') === 'true') {
        if(pinGate) pinGate.classList.add('hidden');
        if(adminShell) adminShell.classList.remove('hidden');
        loadDraftsFromLocal();
    }

    if(btnLogin) btnLogin.addEventListener('click', window.checkPin);

    document.addEventListener('keydown', (e) => {
        if (pinGate && !pinGate.classList.contains('hidden')) {
            if (/^[0-9]$/.test(e.key) && pinInput && pinInput.value.length < 4) {
                pinInput.value += e.key;
                window.checkPin();
            } else if (e.key === 'Backspace') {
                window.delPin();
            } else if (e.key === 'Enter') {
                window.checkPin();
            }
        }
    });

    const navVenues = document.getElementById('nav-venues');
    if (navVenues) navVenues.addEventListener('click', () => switchView('venues'));

    const navEvents = document.getElementById('nav-events');
    if (navEvents) navEvents.addEventListener('click', () => switchView('events'));

    const clipboardFloat = document.getElementById('clipboard-float');
    const clipHeader = document.getElementById('clipboard-header');
    const clipboard = document.getElementById('clipboard-text');
    let isDragging = false, startX, startY, initialLeft, initialTop;

    if(clipHeader && clipboardFloat) {
        clipHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = clipboardFloat.getBoundingClientRect();
            clipboardFloat.style.transform = 'none';
            initialLeft = rect.left; initialTop = rect.top;
            clipboardFloat.style.left = initialLeft + 'px';
            clipboardFloat.style.top = initialTop + 'px';
        });

        document.addEventListener('mousemove', (e) => {
            if(isDragging) {
                clipboardFloat.style.left = (initialLeft + e.clientX - startX) + 'px';
                clipboardFloat.style.top = (initialTop + e.clientY - startY) + 'px';
            }
        });
        document.addEventListener('mouseup', () => isDragging = false);
    }

    if(clipboard) {
        clipboard.value = localStorage.getItem('br_admin_clipboard') || '';
        clipboard.addEventListener('input', (e) => {
            localStorage.setItem('br_admin_clipboard', e.target.value);
        });
    }

    const btnFetchLive = document.getElementById('btn-fetch-live');
    if(btnFetchLive) {
        btnFetchLive.addEventListener('click', async () => {
            try {
                const url = currentMode === 'venues' ? 'listings.json' : 'events.json';
                const res = await fetch(url + '?v=' + new Date().getTime());
                if(!res.ok) throw new Error("Could not find file.");
                liveData = await res.json();
                draftData = JSON.parse(JSON.stringify(liveData)); 
                saveDraftsToLocal();
                renderTable();
                showToast(`Live ${currentMode} data loaded and saved to draft!`);
            } catch(err) {
                showToast("Fetch failed. Try Manual Upload.");
            }
        });
    }

    const fileReplace = document.getElementById('file-upload-replace');
    if(fileReplace) {
        fileReplace.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    draftData = JSON.parse(event.target.result);
                    saveDraftsToLocal();
                    renderTable();
                    showToast("Data replaced successfully!");
                } catch (err) { alert("Error parsing JSON."); }
            };
            reader.readAsText(file);
        });
    }

    const fileMerge = document.getElementById('file-upload-merge');
    if(fileMerge) {
        fileMerge.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const uploadedData = JSON.parse(event.target.result);
                    if(!Array.isArray(uploadedData)) throw new Error("File is not an array");
                    
                    const idField = currentMode === 'venues' ? 'Venue_ID' : 'Event_ID';
                    let mergedCount = 0, addedCount = 0;
                    
                    uploadedData.forEach(newRow => {
                        const existingIdx = draftData.findIndex(d => d[idField] === newRow[idField]);
                        if(existingIdx >= 0) {
                            draftData[existingIdx] = { ...draftData[existingIdx], ...newRow };
                            mergedCount++;
                        } else {
                            draftData.push(newRow);
                            addedCount++;
                        }
                    });
                    
                    saveDraftsToLocal();
                    renderTable();
                    showToast(`Merge Complete: ${mergedCount} updated, ${addedCount} new.`);
                } catch (err) { alert("Error merging JSON."); }
            };
            reader.readAsText(file);
        });
    }

    const btnExportCSV = document.getElementById('btn-export-csv');
    if(btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            if(!draftData || draftData.length === 0) return alert('No data available to export.');
            
            const cols = Object.keys(draftData[0]);
            let csvString = cols.join(',') + '\n';
            
            draftData.forEach(row => {
                csvString += cols.map(c => {
                    let val = row[c] === null || row[c] === undefined ? '' : String(row[c]);
                    val = val.replace(/"/g, '""'); 
                    return `"${val}"`; 
                }).join(',') + '\n';
            });
            
            const blob = new Blob([csvString], {type: 'text/csv'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backroom_${currentMode}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        });
    }

    const btnExportJSON = document.getElementById('btn-export-json');
    if(btnExportJSON) {
        btnExportJSON.addEventListener('click', () => {
            if(!draftData || draftData.length === 0) return alert('No data available to export.');
            const dataStr = JSON.stringify(draftData, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backroom_${currentMode}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast("JSON downloaded.");
        });
    }

    const btnDownloadAll = document.getElementById('btn-download-all');
    if(btnDownloadAll) {
        btnDownloadAll.addEventListener('click', () => {
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
    }

    const summaryMismatch = document.getElementById('summary-mismatch');
    if(summaryMismatch) {
        summaryMismatch.addEventListener('click', () => {
            if(currentMismatchIds.length === 0) return;
            const list = document.getElementById('mismatch-list');
            if(list) {
                list.innerHTML = '';
                currentMismatchIds.forEach(id => {
                    list.innerHTML += `<li style="color:var(--bright-red-orange); font-weight:bold;">${id}</li>`;
                });
            }
            const mismatchModal = document.getElementById('mismatch-modal');
            if(mismatchModal) mismatchModal.classList.remove('hidden');
        });
    }

    const btnHighlightChanges = document.getElementById('btn-highlight-changes');
    if(btnHighlightChanges) {
        btnHighlightChanges.addEventListener('click', () => {
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
    }

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if(modal) modal.classList.add('hidden');
        });
    });
});