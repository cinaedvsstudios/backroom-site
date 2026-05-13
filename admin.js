// Header mapping for space efficiency
const headerMapping = {
    "Event_Start_Time": "Start",
    "Event_End_Time": "End",
    "Venue_ID": "ID",
    "Event_ID": "ID",
    "Description": "Desc",
    "Rating_General": "Gen",
    "Rating_Darkroom": "Dark",
    "Feature_Men_Only": "Men Only"
};

function renderTable() {
    if (!draftData || draftData.length === 0) {
        tableContainer.innerHTML = "<p style='padding:20px;'>No data.</p>";
        return;
    }

    const filteredData = applyTableFilters();
    const columns = Object.keys(draftData[0] || {});

    let html = `<table><thead><tr><th style="width:60px;">Edit</th>`;
        
    columns.forEach((col, idx) => {
        const displayName = headerMapping[col] || col;
        html += `<th class="col-idx-${idx}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="eye-btn" onclick="toggleColumn(${idx})">👁️</span>
                <span class="col-title">${displayName}</span>
            </div>
        </th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    filteredData.forEach((row, rowIndex) => {
        html += `<tr data-id="${row.Venue_ID || row.Event_ID}">
            <td style="text-align:center;">✏️</td>`;
        
        columns.forEach((col, idx) => {
            html += `<td class="col-idx-${idx}" onclick="editCell(this, ${rowIndex}, '${col}')">${String(row[col] || '')}</td>`;
        });
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}

window.toggleColumn = function(idx) {
    const cols = document.querySelectorAll(`.col-idx-${idx}`);
    cols.forEach(c => c.classList.toggle('hidden-col'));
}