let adminVenues = [];

const pinGate = document.getElementById('pin-gate');
const adminShell = document.getElementById('admin-shell');
const tableContainer = document.getElementById('admin-table-container');

// PIN Login Logic (Hardcoded to 1234 for prototype Phase 3)
document.getElementById('btn-login').addEventListener('click', () => {
    const pin = document.getElementById('admin-pin').value;
    if (pin === '1234') {
        pinGate.classList.add('hidden');
        adminShell.classList.remove('hidden');
    } else {
        document.getElementById('pin-error').classList.remove('hidden');
    }
});

// JSON Import Logic
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
        tableContainer.innerHTML = "<p>No venues found in the file.</p>";
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
        
    adminVenues.forEach((v, index) => {
        html += `
            <tr onclick="alert('Editor modal for ${v.Venue_ID} coming in next update!')">
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

// Export Updated JSON
document.getElementById('btn-download-listings').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(adminVenues, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'listings.json';
    a.click();
});