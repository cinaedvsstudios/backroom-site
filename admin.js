let adminVenues = [];

const pinGate = document.getElementById('pin-gate');
const adminShell = document.getElementById('admin-shell');
const tableContainer = document.getElementById('admin-table-container');

// PIN Login (1234)
document.getElementById('btn-login').addEventListener('click', () => {
    const pin = document.getElementById('admin-pin').value;
    if (pin === '1234') {
        pinGate.classList.add('hidden');
        adminShell.classList.remove('hidden');
    } else {
        document.getElementById('pin-error').classList.remove('hidden');
    }
});

// View Switcher
window.switchView = function(viewId) {
    document.getElementById('view-venues').classList.add('hidden');
    document.getElementById('view-discounts').classList.add('hidden');
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
}

// ☁️ Load Current Live Files directly
document.getElementById('btn-fetch-live').addEventListener('click', async () => {
    try {
        const res = await fetch('listings.json');
        if(!res.ok) throw new Error("Could not find listings.json");
        adminVenues = await res.json();
        renderVenuesTable();
        document.getElementById('btn-download-listings').classList.remove('hidden');
        alert("Live site data loaded successfully!");
    } catch(err) {
        alert(err.message + ". You may need to run on a local server or use Manual Upload.");
    }
});

// 📂 Manual JSON Upload
document.getElementById('file-listings').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            adminVenues = JSON.parse(event.target.result);
            renderVenuesTable();
            document.getElementById('btn-download-listings').classList.remove('hidden');
        } catch (err) {
            alert("Error parsing listings.json. Is it a valid JSON file?");
        }
    };
    reader.readAsText(file);
});

// Build Data Table
function renderVenuesTable() {
    if (adminVenues.length === 0) {
        tableContainer.innerHTML = "<p>No venues found.</p>";
        return;
    }

    let html = `<table>
        <thead>
            <tr>
                <th>Venue_ID</th>
                <th>Name</th>
                <th>City</th>
                <th>Status</th>
                <th>Category</th>
            </tr>
        </thead>
        <tbody>`;
        
    adminVenues.forEach((v) => {
        html += `
            <tr onclick="alert('WYSIWYG Editor modal for ${v.Venue_ID} coming in next phase update!')">
                <td>${v.Venue_ID}</td>
                <td><strong>${v.Name}</strong></td>
                <td>${v.City}</td>
                <td>${v.Status}</td>
                <td>${v.Category}</td>
            </tr>`;
    });
    
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}

// 💾 Download JSON
document.getElementById('btn-download-listings').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(adminVenues, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'listings.json';
    a.click();
});

// 💾 Download Page Editor HTML
document.getElementById('btn-download-html').addEventListener('click', () => {
    const content = document.getElementById('page-editor-area').innerHTML;
    const blob = new Blob([content], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'discounts_page.html';
    a.click();
});