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
    const vals = [...new Set(items.map((item) => item[key]).filter(Boolean))];
    // Numeric-aware sort: if values start with a number (e.g. "1. Valmiki Nagar"), sort numerically
    return vals.sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });
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

    // Attach custom tooltip logic
    const segments = document.querySelectorAll('.tally-bar-segment');
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
        segments.forEach(segment => {
            segment.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = e.target.getAttribute('data-tooltip');
                tooltip.classList.add('visible');
            });
            segment.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = (e.clientY - 40) + 'px';
            });
            segment.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
}

function setErrorState(message) {
    elements.result.innerHTML = `
        <div class="error-state">
            <strong>Unable to load dashboard</strong>
            <p>${escapeHtml(message)}</p>
        </div>
    `;

    // Attach custom tooltip logic
    const segments = document.querySelectorAll('.tally-bar-segment');
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
        segments.forEach(segment => {
            segment.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = e.target.getAttribute('data-tooltip');
                tooltip.classList.add('visible');
            });
            segment.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = (e.clientY - 40) + 'px';
            });
            segment.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
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
        return `<div class="tally-bar-segment ${partyClass}" style="width: ${pct}%" data-tooltip="${escapeHtml(stat.party)}: <strong style='color:var(--accent)'>${stat.seats} seats</strong> (${pct.toFixed(1)}%)"></div>`;
    }).join("");

    const legendItems = partyStats.map(stat => {
        const partyClass = `party-${stat.party.toLowerCase().replace(/[^a-z]/g, '')}`;
        const pct = (stat.seats / totalSeats) * 100;
        return `
            <div class="tally-legend-item" onclick="filterByParty('${escapeJsString(stat.party)}')" style="cursor: pointer; transition: all 0.2s; ${window.selectedPartyFilter === stat.party ? 'background: rgba(255,255,255,0.1); border-color: var(--accent);' : ''}">
                <span class="party-badge ${partyClass}">${escapeHtml(stat.party)}</span>
                <strong style="color: #fff; font-size: 14px;">${stat.seats} ${stat.seats === 1 ? 'Seat' : 'Seats'}</strong>
                <span style="color: var(--muted); font-size: 12px;">(${pct.toFixed(1)}%)</span>
                <span style="color: rgba(255,255,255,0.4); font-size: 11px; margin-left: auto;">Avg Lead: ${stat.avgLeadPct}%</span>
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

    // Attach custom tooltip logic
    const segments = document.querySelectorAll('.tally-bar-segment');
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
        segments.forEach(segment => {
            segment.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = e.target.getAttribute('data-tooltip');
                tooltip.classList.add('visible');
            });
            segment.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = (e.clientY - 40) + 'px';
            });
            segment.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
}

function updateSummary(data, fullDataForTally = null) {
    elements.zoneCount.textContent = formatter.format(uniqueValues(data, "zone").length);
    elements.lokSabhaCount.textContent = formatter.format(uniqueValues(data, "loksabha").length);
    elements.assemblyCount.textContent = formatter.format(uniqueValues(data, "assembly").length);

    if (data.length > 0) {
        const totalVotesCast = data.reduce((sum, item) => sum + (item.totalVotes || 0), 0);
        elements.avgMarginStat.textContent = formatter.format(totalVotesCast);
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

    const knownParties = ['iip', 'cpi-m', 'rjd', 'jdu', 'bjp', 'jsp', 'inc', 'aimim', 'ind', 'vip', 'ham', 'cpi-ml', 'rlm', 'vsip', 'bsp', 'ppi', 'ljp-r', 'ljp', 'janata dal (united)', 'rashtriya janata dal', 'bharatiya janata party', 'jan suraaj party', 'indian national congress', 'independent'];
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
            <div style="text-align: right;">
                <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Votes</div>
                <div style="font-size: 22px; font-weight: 800; color: var(--accent);">${formatter.format(totalVotes)}</div>
                <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Winner leads by <span style="color:#f8fafc; font-weight:700;">${((margin / totalVotes) * 100).toFixed(1)}%</span></div>
            </div>
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

    // Attach custom tooltip logic
    const segments = document.querySelectorAll('.tally-bar-segment');
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
        segments.forEach(segment => {
            segment.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = e.target.getAttribute('data-tooltip');
                tooltip.classList.add('visible');
            });
            segment.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = (e.clientY - 40) + 'px';
            });
            segment.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
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

    const tableRows = list.map((row, index) => {
        const winnerName = row.winner ? row.winner.name : 'N/A';
        const winnerParty = row.winner ? row.winner.party : 'IND';
        const winnerCaste = row.winner ? row.winner.caste : 'N/A';
        const winnerPartyClass = `party-${winnerParty.toLowerCase().replace(/[^a-z]/g, '')}`;

        const runnerName = row.runner ? row.runner.name : 'N/A';
        const runnerParty = row.runner ? row.runner.party : 'IND';
        const runnerCaste = row.runner ? row.runner.caste : 'N/A';
        const runnerPartyClass = `party-${runnerParty.toLowerCase().replace(/[^a-z]/g, '')}`;

        const marginPct = (row.margin / maxMargin) * 100;

        const winnerVotes = row.winner ? row.winner.votes : 0;
        const runnerVotes = row.runner ? row.runner.votes : 0;
        const rowTotalVotes = (row.totalVotes && row.totalVotes > 0) ? row.totalVotes : (winnerVotes + runnerVotes) || 1;
        const winnerPct = ((winnerVotes / rowTotalVotes) * 100).toFixed(1);
        const runnerPct = ((runnerVotes / rowTotalVotes) * 100).toFixed(1);
        
        const delay = index < 20 ? (index * 0.03).toFixed(2) : 0; // Cap animation delay to first 20 rows

        return `
            <tr onclick="selectConstituency('${escapeJsString(row.zone)}', '${escapeJsString(row.loksabha)}', '${escapeJsString(row.assembly)}')" class="constituency-row" style="animation-delay: ${delay}s">
                <td data-label="Constituency">
                    <strong style="font-size: 15px; color: #fff;">${escapeHtml(row.assembly)}</strong>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${escapeHtml(row.zone)} / ${escapeHtml(row.loksabha)}</div>
                    <!-- Mobile card layout — hidden on desktop via CSS -->
                    <div class="mobile-candidates-row">
                        <div class="mobile-cand-card">
                            <div class="mobile-cand-label winner">🏆 Winner</div>
                            <div>
                                <span class="party-badge ${winnerPartyClass}" style="padding:2px 6px;font-size:10px;margin-bottom:4px;display:inline-block;">${escapeHtml(winnerParty)}</span>
                            </div>
                            <div class="mobile-cand-name">${escapeHtml(winnerName)}</div>
                            <div>
                                <span class="mobile-cand-votes winner">${formatter.format(winnerVotes)}</span>
                                <span class="mobile-cand-pct">${winnerPct}%</span>
                            </div>
                        </div>
                        <div class="mobile-cand-card">
                            <div class="mobile-cand-label runner">Runner Up</div>
                            <div>
                                <span class="party-badge ${runnerPartyClass}" style="padding:2px 6px;font-size:10px;margin-bottom:4px;display:inline-block;">${escapeHtml(runnerParty)}</span>
                            </div>
                            <div class="mobile-cand-name">${escapeHtml(runnerName)}</div>
                            <div>
                                <span class="mobile-cand-votes runner">${formatter.format(runnerVotes)}</span>
                                <span class="mobile-cand-pct">${runnerPct}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="mobile-total-row">
                        <span style="color:var(--muted);">Total: <span>${formatter.format(rowTotalVotes)}</span></span>
                        <span style="color:var(--muted);">Lead: <span style="color:var(--winner);">${((row.margin / rowTotalVotes) * 100).toFixed(1)}%</span></span>
                    </div>
                </td>
                <td data-label="Winner">
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        <span class="party-badge ${winnerPartyClass}" style="padding: 2px 6px; font-size: 10px;">${escapeHtml(winnerParty)}</span>
                        <strong>${escapeHtml(winnerName)}</strong>
                    </div>
                    <div style="margin-top: 5px; display:flex; align-items:center; gap:8px;">
                        <span style="font-size:13px; font-weight:700; color:var(--winner);">${formatter.format(winnerVotes)}</span>
                        <span style="font-size:12px; color:var(--muted);">${winnerPct}%</span>
                    </div>
                </td>
                <td data-label="Runner Up">
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        <span class="party-badge ${runnerPartyClass}" style="padding: 2px 6px; font-size: 10px;">${escapeHtml(runnerParty)}</span>
                        <strong>${escapeHtml(runnerName)}</strong>
                    </div>
                    <div style="margin-top: 5px; display:flex; align-items:center; gap:8px;">
                        <span style="font-size:13px; font-weight:700; color:var(--runner);">${formatter.format(runnerVotes)}</span>
                        <span style="font-size:12px; color:var(--muted);">${runnerPct}%</span>
                    </div>
                </td>
                <td data-label="Votes & %">
                    <div style="font-size:13px; font-weight:700; color:#fff;">${formatter.format(rowTotalVotes)}</div>
                    <div style="font-size:11px; color:var(--muted); margin-top:3px;">Lead: <span style="color:var(--winner); font-weight:700;">${((row.margin / rowTotalVotes) * 100).toFixed(1)}%</span></div>
                </td>
            </tr>
        `;
    }).join("");

    
    let loksabhaCardHtml = '';
    const selectedLS = elements.lokSabha.value;
    if (selectedLS && state.loksabhaData) {
        const lsData = state.loksabhaData.find(item => item.loksabhaName === selectedLS);
        if (lsData && lsData.winner.name !== 'Unknown') {
            const partyClass = `party-${lsData.winner.party.toLowerCase().replace(/[^a-z]/g, '')}`;
            const lsTotalVotes = lsData.winner.votes + lsData.runner.votes;
            const lsWinnerPct = lsTotalVotes > 0 ? ((lsData.winner.votes / lsTotalVotes) * 100).toFixed(1) : '0.0';
            const lsRunnerPct = lsTotalVotes > 0 ? ((lsData.runner.votes / lsTotalVotes) * 100).toFixed(1) : '0.0';
            const runnerPartyClass = `party-${lsData.runner.party.toLowerCase().replace(/[^a-z]/g, '')}`;
            loksabhaCardHtml = `
                <div class="loksabha-result-card" style="margin-bottom: 24px; padding: 18px 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight:800; margin-bottom: 12px;">🏛 2024 Lok Sabha Result</div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                        <div>
                            <span class="party-badge ${partyClass}" style="font-size: 11px; padding: 3px 8px; margin-bottom:6px; display:inline-block;">${escapeHtml(lsData.winner.party)}</span>
                            <div style="font-size: 18px; font-weight:800; color: var(--text);">${escapeHtml(lsData.winner.name)}</div>
                            <div style="margin-top:4px; display:flex; gap:10px; align-items:center;">
                                <span style="font-size:15px; font-weight:700; color:var(--winner);">${formatter.format(lsData.winner.votes)}</span>
                                <span style="font-size:13px; color:var(--muted);">${lsWinnerPct}%</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:11px; color:var(--muted); margin-bottom:6px;">Runner Up</div>
                            <span class="party-badge ${runnerPartyClass}" style="font-size: 11px; padding: 3px 8px; margin-bottom:6px; display:inline-block;">${escapeHtml(lsData.runner.party)}</span>
                            <div style="font-size: 15px; font-weight:700; color: var(--text);">${escapeHtml(lsData.runner.name)}</div>
                            <div style="margin-top:4px; display:flex; gap:10px; align-items:center; justify-content:flex-end;">
                                <span style="font-size:14px; font-weight:700; color:var(--runner);">${formatter.format(lsData.runner.votes)}</span>
                                <span style="font-size:12px; color:var(--muted);">${lsRunnerPct}%</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:10px; font-size:12px; color:var(--muted);">Total votes: ${formatter.format(lsTotalVotes)} &nbsp;·&nbsp; Lead: <span style="color:var(--winner); font-weight:700;">${((lsData.margin / lsTotalVotes) * 100).toFixed(1)}%</span></div>
                </div>
            `;
        }
    }

    
    if (list.length === 0) {
        elements.result.innerHTML = `
            <div class="list-results-header">
                <h3>Constituencies</h3>
                <span class="count-pill">0 seats</span>
            </div>
            ${loksabhaCardHtml}
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <h3>No results found</h3>
                <p>We couldn't find any constituencies matching your filters or search.</p>
                <button class="reset-btn" onclick="resetFilters()" style="margin-top: 16px;">Clear Filters</button>
            </div>
        `;
        return;
    }

    elements.result.innerHTML = `
        <div class="list-results-header">
            <h3>Constituencies</h3>
            <span class="count-pill">${list.length} seats</span>
        </div>
        ${loksabhaCardHtml}
        <div class="constituency-table-wrapper">
            <table class="constituency-table">
                <thead>
                    <tr>
                        <th>Constituency</th>
                        <th>Winner</th>
                        <th>Runner Up</th>
                        <th>Votes & %</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;

    // Attach custom tooltip logic
    const segments = document.querySelectorAll('.tally-bar-segment');
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
        segments.forEach(segment => {
            segment.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = e.target.getAttribute('data-tooltip');
                tooltip.classList.add('visible');
            });
            segment.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = (e.clientY - 40) + 'px';
            });
            segment.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
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

        const assemblyRaw = rawData.assembly || (Array.isArray(rawData) ? rawData : []);
        const loksabhaRaw = rawData.loksabha || [];

        state.loksabhaData = loksabhaRaw.map(row => {
            const segments = (row.loksabha || "").split('|');
            let winner = { name: 'Unknown', party: 'IND', votes: 0 };
            let runner = { name: 'Unknown', party: 'IND', votes: 0 };
            
            for (const seg of segments) {
                const s = seg.trim();
                const match = s.match(/([^(]+)\s*\(([^)]+)\)\s*([\d,]+)/);
                if (match) {
                    const nameParts = match[1].split(':');
                    const name = nameParts[nameParts.length - 1].trim();
                    const party = match[2].trim();
                    const votes = parseInt(match[3].replace(/,/g, ''), 10) || 0;
                    
                    if (s.toLowerCase().includes('winner') || s.toLowerCase().startsWith('w:')) {
                        winner = { name, party, votes };
                    } else if (s.toLowerCase().includes('runner') || s.toLowerCase().startsWith('r:')) {
                        runner = { name, party, votes };
                    }
                }
            }
            
            return {
                loksabhaName: row.zone,
                winner,
                runner,
                margin: Math.abs(winner.votes - runner.votes)
            };
        });

        state.data = assemblyRaw.map(row => {
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

// ── Mobile Filter Drawer ──────────────────────────────────────────
(function () {
    const fab     = document.getElementById('filterFab');
    const panel   = document.getElementById('filtersPanel');
    const overlay = document.getElementById('filterOverlay');
    if (!fab || !panel || !overlay) return;

    function openDrawer() {
        panel.classList.add('drawer-open');
        overlay.classList.add('visible');
        fab.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
        panel.classList.remove('drawer-open');
        overlay.classList.remove('visible');
        fab.classList.remove('open');
        document.body.style.overflow = '';
    }

    fab.addEventListener('click', () => {
        panel.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
    });
    overlay.addEventListener('click', closeDrawer);

    // Close drawer when a filter changes on mobile
    ['zone', 'ls', 'assembly', 'sortBy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (window.innerWidth <= 768) closeDrawer();
        });
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeDrawer();
    });
})();

// ── Search UX: clear button + keyboard shortcut ───────────────────
(function () {
    const clearBtn = document.getElementById('clearSearch');
    const searchEl = elements.search;
    if (clearBtn && searchEl) {
        clearBtn.addEventListener('click', () => {
            searchEl.value = '';
            renderDashboard();
            searchEl.focus();
        });
    }

    document.addEventListener('keydown', e => {
        if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) &&
            document.activeElement !== searchEl &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'SELECT') {
            e.preventDefault();
            searchEl.focus();
            if (window.innerWidth <= 768) {
                const panel   = document.getElementById('filtersPanel');
                const overlay = document.getElementById('filterOverlay');
                const fab     = document.getElementById('filterFab');
                if (panel)   panel.classList.add('drawer-open');
                if (overlay) overlay.classList.add('visible');
                if (fab)     fab.classList.add('open');
            }
        }
    });
})();
