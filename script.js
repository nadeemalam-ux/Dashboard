const API =
    "https://script.google.com/macros/s/AKfycbw3h4ZkxAcvB_ox6_3OvW9iNTgFtAsuXqyaEsCBckK5_1yGHGGU3_9v8-P4M7D_wTDrlQ/exec";

window.selectedPartyFilter = null;
const state = {
    data: [],
};

const elements = {
    zone: document.getElementById("zone"),
    lokSabha: document.getElementById("ls"),
    assembly: document.getElementById("assembly"),
    search: document.getElementById("search"),
    sortBy: document.getElementById("sortBy"),
    result: document.getElementById("result"),
    zoneCount: document.getElementById("zoneCount"),
    lokSabhaCount: document.getElementById("lokSabhaCount"),
    assemblyCount: document.getElementById("assemblyCount"),
    avgMarginStat: document.getElementById("avgMarginStat"),
    topPartyStat: document.getElementById("topPartyStat"),
};

const formatter = new Intl.NumberFormat("en-IN");

function uniqueValues(items, key) {
    return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });
}

function escapeJsString(str = "") {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function fillSelect(select, values, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function setLoading() {
    elements.result.innerHTML = `
        <div class="loading-state">
            <span class="loader" aria-hidden="true"></span>
            <p>Loading Bihar election data...</p>
        </div>
    `;
}

function setErrorState(message) {
    elements.result.innerHTML = `
        <div class="error-state">
            <strong>Unable to load dashboard</strong>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function getPartyTally(data) {
    const tally = {};
    data.forEach(row => {
        if (row.winner && row.winner.party) {
            const party = row.winner.party;
            if (!tally[party]) {
                tally[party] = {
                    seats: 0,
                    totalMargin: 0
                };
            }
            tally[party].seats += 1;
            tally[party].totalMargin += row.margin || 0;
        }
    });
    return Object.entries(tally)
        .map(([party, stats]) => ({
            party,
            seats: stats.seats,
            avgMargin: Math.round(stats.totalMargin / stats.seats)
        }))
        .sort((a, b) => b.seats - a.seats);
}

function updatePartyTally(data) {
    const tallyContainer = document.getElementById("tally-section");
    if (!tallyContainer) return;

    if (data.length === 0) {
        tallyContainer.style.display = "none";
        return;
    }

    tallyContainer.style.display = "block";
    const partyStats = getPartyTally(data);
    const totalSeats = data.length;

    const barSegments = partyStats.map(stat => {
        const pct = (stat.seats / totalSeats) * 100;
        const partyClass = `party-${stat.party.toLowerCase().replace(/[^a-z]/g, '')}`;
        return `<div class="tally-bar-segment ${partyClass}" style="width: ${pct}%" title="${escapeHtml(stat.party)}: ${stat.seats} seats (${pct.toFixed(1)}%)"></div>`;
    }).join("");

    const legendItems = partyStats.map(stat => {
        const partyClass = `party-${stat.party.toLowerCase().replace(/[^a-z]/g, '')}`;
        const pct = (stat.seats / totalSeats) * 100;
        return `
            <div class="tally-legend-item" onclick="filterByParty('${escapeJsString(stat.party)}')" style="cursor: pointer; transition: all 0.2s; ${window.selectedPartyFilter === stat.party ? 'background: rgba(255,255,255,0.1); border-color: var(--accent);' : ''}">
                <span class="party-badge ${partyClass}">${escapeHtml(stat.party)}</span>
                <strong style="color: #fff; font-size: 14px;">${stat.seats} ${stat.seats === 1 ? 'Seat' : 'Seats'}</strong>
                <span style="color: var(--muted); font-size: 12px;">(${pct.toFixed(1)}%)</span>
                <span style="color: rgba(255,255,255,0.4); font-size: 11px; margin-left: auto;">Avg Margin: ${formatter.format(stat.avgMargin)}</span>
            </div>
        `;
    }).join("");

    tallyContainer.innerHTML = `
        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; font-weight: 700; color: var(--accent);">
            Party Seat Share & Leads Tally
        </h3>
        <div class="tally-bar-container" style="height: 16px; display: flex; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.08); margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
            ${barSegments}
        </div>
        <div class="tally-legend-grid">
            ${legendItems}
        </div>
    `;
}

function updateSummary(data, fullDataForTally = null) {
    elements.zoneCount.textContent = formatter.format(uniqueValues(data, "zone").length);
    elements.lokSabhaCount.textContent = formatter.format(uniqueValues(data, "loksabha").length);
    elements.assemblyCount.textContent = formatter.format(uniqueValues(data, "assembly").length);

    if (data.length > 0) {
        const totalMargin = data.reduce((sum, item) => sum + (item.margin || 0), 0);
        const avgMargin = Math.round(totalMargin / data.length);
        elements.avgMarginStat.textContent = formatter.format(avgMargin);
    } else {
        elements.avgMarginStat.textContent = "--";
    }

    const partyStats = getPartyTally(data);
    if (partyStats.length > 0) {
        elements.topPartyStat.textContent = partyStats[0].party;
    } else {
        elements.topPartyStat.textContent = "--";
    }

    updatePartyTally(fullDataForTally || data);
}

function parseCandidates(details = "") {
    // Pre-split inline declarations (e.g. Winner... Runner Up...)
    const cleanDetails = details.replace(/(?<!^)\b(MLA|Runner Up|\d+(?:st|nd|rd|th)\s+Runner\s+Up)\b/gi, '\n$1');
    const lines = cleanDetails.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const candidates = [];
    let current = null;

    const isHeader = (line) => {
        const lower = line.toLowerCase();
        return lower.startsWith('mla') || lower.includes('runner up') || /^\d+(st|nd|rd|th)\s+runner\s+up/i.test(line);
    };

    const getLabel = (line) => {
        const match = line.match(/^(mla|runner up|\d+(?:st|nd|rd|th)\s+runner\s+up)/i);
        if (match) {
            const lbl = match[1].trim();
            return lbl.toLowerCase() === 'mla' ? 'Winner' : lbl;
        }
        return null;
    };

    for (const line of lines) {
        if (isHeader(line)) {
            if (current) candidates.push(current);
            current = {
                label: getLabel(line),
                raw: [line],
                name: '',
                party: '',
                caste: '',
                votes: 0
            };
        } else if (current) {
            current.raw.push(line);
        }
    }
    if (current) candidates.push(current);

    const knownParties = ['iip', 'rjd', 'jdu', 'bjp', 'jsp', 'inc', 'aimim', 'ind', 'vip', 'ham', 'cpi-ml', 'rlm', 'vsip', 'bsp', 'ppi', 'ljp-r', 'ljp', 'janata dal (united)', 'rashtriya janata dal', 'bharatiya janata party', 'jan suraaj party', 'indian national congress', 'independent'];
    const partyAliases = {
        'jsp0': 'JSP',
        'ind.': 'IND',
        'ind': 'IND',
        'independent': 'IND',
        'janata dal (united)': 'JDU',
        'rashtriya janata dal': 'RJD',
        'bharatiya janata party': 'BJP',
        'jan suraaj party': 'JSP',
        'indian national congress': 'INC'
    };

    return candidates.map(cand => {
        let text = cand.raw.join(' ');

        // Remove label
        text = text.replace(/^(mla|runner up|\d+(?:st|nd|rd|th)\s+runner\s+up)\s*[-–—:]?\s*/i, '').trim();

        // Extract Votes
        let votes = 0;
        const votesMatch = text.match(/votes\s*[-–—:]?\s*([\d,\+]+)/i);
        if (votesMatch) {
            const digits = votesMatch[1].replace(/\D/g, '');
            votes = parseInt(digits, 10) || 0;
            text = text.replace(/votes\s*[-–—:]?\s*([\d,\+]+)/i, '').trim();
        }

        // Extract Caste if "Caste - Koiri"
        let caste = '';
        const casteMatch = text.match(/caste\s*[-–—:]?\s*([a-zA-Z\s]+)/i);
        if (casteMatch) {
            caste = casteMatch[1].trim();
            text = text.replace(/caste\s*[-–—:]?\s*[a-zA-Z\s]+/i, '').trim();
        }

        text = text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

        // Extract parenthesized contents
        const parens = [];
        const parenRegex = /\(([^)]+)\)/g;
        let pMatch;
        while ((pMatch = parenRegex.exec(text)) !== null) {
            parens.push(pMatch[1].trim());
        }

        let nameOnly = text.replace(/\([^)]+\)/g, ' ').replace(/\s+/g, ' ').trim();

        let party = '';
        parens.forEach(content => {
            const lower = content.toLowerCase();
            if (knownParties.includes(lower) || partyAliases[lower]) {
                party = partyAliases[lower] || content.toUpperCase();
            } else if (!caste) {
                caste = content;
            }
        });

        // Fallbacks for party
        if (!party) {
            for (const p of knownParties) {
                const regex = new RegExp(`\\b${p}\\b$`, 'i');
                if (regex.test(nameOnly)) {
                    party = partyAliases[p.toLowerCase()] || p.toUpperCase();
                    nameOnly = nameOnly.replace(regex, '').trim();
                    break;
                }
            }
        }

        if (!party) {
            for (const p of ['IND', 'RJD', 'JDU', 'BJP', 'JSP', 'INC', 'AIMIM', 'VIP', 'HAM', 'BSP', 'RLM', 'LJP-R', 'LJP']) {
                if (nameOnly.endsWith(p)) {
                    party = p;
                    nameOnly = nameOnly.substring(0, nameOnly.length - p.length).trim();
                    break;
                }
            }
        }

        if (party && partyAliases[party.toLowerCase()]) {
            party = partyAliases[party.toLowerCase()];
        }

        // Fallback for caste scan in text
        if (!caste) {
            const commonCastes = ['yadav', 'kurmi', 'dhanuk', 'bhumihar', 'minority', 'koiri', 'rajput', 'baniya', 'brahmin', 'bramhim', 'dusadh', 'pasi', 'teli', 'sonar', 'dhobi', 'mallah', 'kevrat', 'gangota', 'kushwaha', 'rajwar', 'tanti', 'bind', 'dangi', 'chamar', 'beldar'];
            for (const c of commonCastes) {
                const regex = new RegExp(`\\b${c}\\b`, 'i');
                if (regex.test(text)) {
                    caste = c.charAt(0).toUpperCase() + c.slice(1);
                    nameOnly = nameOnly.replace(regex, '').trim();
                    break;
                }
            }
        }

        let name = nameOnly.replace(/^[-\s,]+|[-\s,]+$/g, '').trim();
        if (name === name.toLowerCase()) {
            name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        if (caste) {
            caste = caste.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        return {
            label: cand.label,
            name: name || 'Unknown Candidate',
            party: party || 'IND',
            caste: caste || 'N/A',
            votes: votes
        };
    });
}

function renderSingleAssembly(row) {
    const margin = row.margin;

    // Sort candidates by votes descending and rank them
    const sortedCandidates = [...row.candidates].sort((a, b) => b.votes - a.votes);

    // Calculate total votes and max votes for comparable bars
    const totalVotes = sortedCandidates.reduce((sum, c) => sum + c.votes, 0) || 1;
    const maxVotes = Math.max(...sortedCandidates.map(c => c.votes)) || 1;

    const standingRows = sortedCandidates.map((c, index) => {
        const rank = index + 1;
        const barWidth = (c.votes / maxVotes) * 100;
        const voteShare = (c.votes / totalVotes) * 100;
        const partyClass = `party-${c.party.toLowerCase().replace(/[^a-z]/g, '')}`;

        let fillClass = 'other';
        if (rank === 1) fillClass = 'winner';
        else if (rank === 2) fillClass = 'runner';

        return `
            <div class="standing-row rank-${rank}">
                <div class="standing-rank">${rank}</div>
                <div class="standing-info">
                    <div class="standing-name-row">
                        <span class="standing-name">${escapeHtml(c.name)}</span>
                        <span class="party-badge ${partyClass}">${escapeHtml(c.party)}</span>
                        <span class="caste-badge">Caste: ${escapeHtml(c.caste)}</span>
                    </div>
                </div>
                <div class="standing-votes">
                    ${formatter.format(c.votes)}
                    <span>${voteShare.toFixed(1)}% share</span>
                </div>
                <div class="standing-bar-container">
                    <div class="standing-bar">
                        <div class="standing-fill ${partyClass}" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    elements.result.innerHTML = `
        <div class="result-header">
            <div>
                <p style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: var(--muted); font-weight: 700;">
                    ${escapeHtml(row.zone)} Zone / ${escapeHtml(row.loksabha)} Lok Sabha
                </p>
                <h2 style="margin-top: 4px; font-size: clamp(20px, 3vw, 26px);">${escapeHtml(row.assembly)}</h2>
            </div>
            <div class="margin-pill">Margin: ${formatter.format(margin)} votes</div>
        </div>
        
        <div class="details-panel" style="margin-top: 0;">
            <h3 style="margin-bottom: 14px; font-weight: 700; color: #f8fafc; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
                Candidate Standings & Vote Share
            </h3>
            <div class="standings-list">
                ${standingRows}
            </div>
        </div>
        
        <div class="details-panel" style="margin-top: 18px;">
            <h3 style="margin-bottom: 10px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
                Constituency Notes & Details
            </h3>
            <pre>${escapeHtml(row.details)}</pre>
        </div>
    `;
}

function renderConstituenciesList(list) {
    if (list.length === 0) {
        elements.result.innerHTML = `
            <div class="empty-state">
                <strong>No matching constituencies found</strong>
                <p>Try refining your search query or dropdown filters.</p>
            </div>
        `;
        return;
    }

    const maxMargin = Math.max(...list.map(r => r.margin)) || 1;

    const tableRows = list.map(row => {
        const winnerName = row.winner ? row.winner.name : 'N/A';
        const winnerParty = row.winner ? row.winner.party : 'IND';
        const winnerCaste = row.winner ? row.winner.caste : 'N/A';
        const winnerPartyClass = `party-${winnerParty.toLowerCase().replace(/[^a-z]/g, '')}`;

        const runnerName = row.runner ? row.runner.name : 'N/A';
        const runnerParty = row.runner ? row.runner.party : 'IND';
        const runnerCaste = row.runner ? row.runner.caste : 'N/A';
        const runnerPartyClass = `party-${runnerParty.toLowerCase().replace(/[^a-z]/g, '')}`;

        const marginPct = (row.margin / maxMargin) * 100;

        return `
            <tr onclick="selectConstituency('${escapeJsString(row.zone)}', '${escapeJsString(row.loksabha)}', '${escapeJsString(row.assembly)}')" class="constituency-row">
                <td data-label="Constituency">
                    <strong style="font-size: 15px; color: #fff;">${escapeHtml(row.assembly)}</strong>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${escapeHtml(row.zone)} / ${escapeHtml(row.loksabha)}</div>
                </td>
                <td data-label="Winner">
                    <div>
                        <span class="party-badge ${winnerPartyClass}" style="padding: 2px 6px; font-size: 10px; margin-right: 4px;">${escapeHtml(winnerParty)}</span>
                        <strong>${escapeHtml(winnerName)}</strong>
                    </div>
                    <div style="margin-top: 4px;">
                        <span class="caste-badge" style="margin-left: 0;">Caste: ${escapeHtml(winnerCaste)}</span>
                    </div>
                </td>
                <td data-label="Runner Up">
                    <div>
                        <span class="party-badge ${runnerPartyClass}" style="padding: 2px 6px; font-size: 10px; margin-right: 4px;">${escapeHtml(runnerParty)}</span>
                        <strong>${escapeHtml(runnerName)}</strong>
                    </div>
                    <div style="margin-top: 4px;">
                        <span class="caste-badge" style="margin-left: 0;">Caste: ${escapeHtml(runnerCaste)}</span>
                    </div>
                </td>
                <td data-label="Margin">
                    <strong>${formatter.format(row.margin)}</strong>
                    <div class="mini-margin-bar">
                        <div class="mini-margin-fill ${winnerPartyClass}" style="width: ${marginPct}%"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    elements.result.innerHTML = `
        <div class="list-results-header">
            <h3>Constituencies</h3>
            <span class="count-pill">${list.length} seats</span>
        </div>
        <div class="constituency-table-wrapper">
            <table class="constituency-table">
                <thead>
                    <tr>
                        <th>Constituency</th>
                        <th>Winner (Leading Candidate)</th>
                        <th>Runner Up</th>
                        <th>Margin</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

window.selectConstituency = function (zone, loksabha, assembly) {
    elements.zone.value = zone;

    const lokSabhaValues = uniqueValues(
        state.data.filter((item) => item.zone === zone),
        "loksabha"
    );
    fillSelect(elements.lokSabha, lokSabhaValues, "Select Lok Sabha");
    elements.lokSabha.disabled = false;
    elements.lokSabha.value = loksabha;

    const assemblyValues = uniqueValues(
        state.data.filter((item) => item.zone === zone && item.loksabha === loksabha),
        "assembly"
    );
    fillSelect(elements.assembly, assemblyValues, "Select Assembly");
    elements.assembly.disabled = false;
    elements.assembly.value = assembly;

    renderDashboard();
};

function renderDashboard() {
    const selectedZone = elements.zone.value;
    const selectedLS = elements.lokSabha.value;
    const selectedAssembly = elements.assembly.value;
    const searchQuery = elements.search.value.toLowerCase().trim();
    const sortVal = elements.sortBy.value;

    let filteredData = state.data;

    if (selectedZone) {
        filteredData = filteredData.filter(item => item.zone === selectedZone);
    }
    if (selectedLS) {
        filteredData = filteredData.filter(item => item.loksabha === selectedLS);
    }

    if (selectedAssembly) {
        const row = state.data.find(
            item => (!selectedZone || item.zone === selectedZone) &&
                (!selectedLS || item.loksabha === selectedLS) &&
                item.assembly === selectedAssembly
        );
        if (row) {
            renderSingleAssembly(row);
            updateSummary(filteredData, filteredData);
            return;
        }
    }

    if (searchQuery) {
        filteredData = filteredData.filter(row => {
            const matchName = row.assembly.toLowerCase().includes(searchQuery);
            const matchZone = row.zone.toLowerCase().includes(searchQuery);
            const matchLS = row.loksabha.toLowerCase().includes(searchQuery);

            const matchCandidates = row.candidates.some(c =>
                c.name.toLowerCase().includes(searchQuery) ||
                c.party.toLowerCase().includes(searchQuery) ||
                c.caste.toLowerCase().includes(searchQuery)
            );
            return matchName || matchZone || matchLS || matchCandidates;
        });
    }

    if (sortVal === 'name') {
        filteredData.sort((a, b) => a.assembly.localeCompare(b.assembly));
    } else if (sortVal === 'margin-desc') {
        filteredData.sort((a, b) => b.margin - a.margin);
    } else if (sortVal === 'margin-asc') {
        filteredData.sort((a, b) => a.margin - b.margin);
    } else if (sortVal === 'votes-desc') {
        filteredData.sort((a, b) => b.totalVotes - a.totalVotes);
    }

    
    const dataBeforePartyFilter = [...filteredData];
    
    if (window.selectedPartyFilter) {
        filteredData = filteredData.filter(row => row.winner && row.winner.party === window.selectedPartyFilter);
    }
    
    renderConstituenciesList(filteredData);
    updateSummary(filteredData, dataBeforePartyFilter);

}

function resetSelect(select, placeholder) {
    fillSelect(select, [], placeholder);
    select.disabled = true;
}

function updateAssemblyDropdown() {
    const zone = elements.zone.value;
    const lokSabha = elements.lokSabha.value;

    if (lokSabha) {
        let assemblyValues;
        if (zone) {
            assemblyValues = uniqueValues(
                state.data.filter((item) => item.zone === zone && item.loksabha === lokSabha),
                "assembly"
            );
        } else {
            assemblyValues = uniqueValues(
                state.data.filter((item) => item.loksabha === lokSabha),
                "assembly"
            );
        }
        fillSelect(elements.assembly, assemblyValues, "Select Assembly");
        elements.assembly.disabled = false;
    } else {
        resetSelect(elements.assembly, "Select Assembly");
    }
}

function handleZoneChange() {
    const zone = elements.zone.value;
    const currentLS = elements.lokSabha.value;

    let lokSabhaValues;
    if (zone) {
        lokSabhaValues = uniqueValues(
            state.data.filter((item) => item.zone === zone),
            "loksabha"
        );
    } else {
        lokSabhaValues = uniqueValues(state.data, "loksabha");
    }

    fillSelect(elements.lokSabha, lokSabhaValues, "Select Lok Sabha");
    elements.lokSabha.disabled = false;

    if (currentLS && lokSabhaValues.includes(currentLS)) {
        elements.lokSabha.value = currentLS;
        updateAssemblyDropdown();
    } else {
        resetSelect(elements.assembly, "Select Assembly");
    }

    renderDashboard();
}

function handleLokSabhaChange() {
    updateAssemblyDropdown();
    renderDashboard();
}

function handleAssemblyChange() {
    renderDashboard();
}

async function initDashboard() {
    setLoading();

    try {
        const response = await fetch(API);

        if (!response.ok) {
            throw new Error("The election API returned an error.");
        }

        const rawData = await response.json();

        state.data = rawData.map(row => {
            const candidates = parseCandidates(row.details);
            const winner = candidates.find(c => c.label === 'Winner') || candidates[0] || null;
            const runner = candidates.find(c => c.label === 'Runner Up') || candidates[1] || null;

            const winnerVotes = winner ? winner.votes : 0;
            const runnerVotes = runner ? runner.votes : 0;
            const margin = Math.abs(winnerVotes - runnerVotes);
            const totalVotes = winnerVotes + runnerVotes;

            return {
                ...row,
                candidates,
                winner,
                runner,
                margin,
                totalVotes
            };
        });

        fillSelect(elements.zone, uniqueValues(state.data, "zone"), "Select Zone");
        fillSelect(elements.lokSabha, uniqueValues(state.data, "loksabha"), "Select Lok Sabha");
        elements.lokSabha.disabled = false;
        renderDashboard();
    } catch (error) {
        setErrorState(error.message || "Please check your connection and try again.");
    }
}

function resetAllFilters() {
    elements.zone.value = "";
    elements.search.value = "";
    elements.sortBy.value = "name";

    resetSelect(elements.lokSabha, "Select Lok Sabha");
    fillSelect(elements.lokSabha, uniqueValues(state.data, "loksabha"), "Select Lok Sabha");
    elements.lokSabha.disabled = false;

    resetSelect(elements.assembly, "Select Assembly");

    renderDashboard();
}

elements.zone.addEventListener("change", handleZoneChange);
elements.lokSabha.addEventListener("change", handleLokSabhaChange);
elements.assembly.addEventListener("change", handleAssemblyChange);
elements.search.addEventListener("input", renderDashboard);
elements.sortBy.addEventListener("change", renderDashboard);
document.getElementById("reset-filters").addEventListener("click", resetAllFilters);

initDashboard();

window.filterByParty = function(party) {
    if (window.selectedPartyFilter === party) {
        window.selectedPartyFilter = null;
    } else {
        window.selectedPartyFilter = party;
    }
    renderDashboard();
};
