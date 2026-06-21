const API =
    "https://script.google.com/macros/s/AKfycbw3h4ZkxAcvB_ox6_3OvW9iNTgFtAsuXqyaEsCBckK5_1yGHGGU3_9v8-P4M7D_wTDrlQ/exec";

const state = {
    data: [],
};

const elements = {
    zone: document.getElementById("zone"),
    lokSabha: document.getElementById("ls"),
    assembly: document.getElementById("assembly"),
    result: document.getElementById("result"),
    zoneCount: document.getElementById("zoneCount"),
    lokSabhaCount: document.getElementById("lokSabhaCount"),
    assemblyCount: document.getElementById("assemblyCount"),
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
            <p>Loading election data...</p>
        </div>
    `;
}

function setEmptyState() {
    elements.result.innerHTML = `
        <div class="empty-state">
            <strong>Select a constituency</strong>
            <p>Choose Zone, Lok Sabha, and Assembly to compare the leading vote shares.</p>
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

function updateSummary(data) {
    elements.zoneCount.textContent = formatter.format(uniqueValues(data, "zone").length);
    elements.lokSabhaCount.textContent = formatter.format(uniqueValues(data, "loksabha").length);
    elements.assemblyCount.textContent = formatter.format(uniqueValues(data, "assembly").length);
}

function parseDetails(details = "") {
    const lines = details
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const winner = (details.match(/MLA-\s*(.*)/i) || ["", "Winner"])[1].trim();
    const runner = (details.match(/Runner Up-\s*(.*)/i) || ["", "Runner Up"])[1].trim();
    const votes = details.match(/Votes-\s*([\d,]+)/gi) || [];
    const winnerVotes = votes[0] ? Number(votes[0].replace(/\D/g, "")) : 0;
    const runnerVotes = votes[1] ? Number(votes[1].replace(/\D/g, "")) : 0;

    return {
        winner,
        runner,
        winnerVotes,
        runnerVotes,
        lines,
    };
}

function candidateTemplate(candidate) {
    const candidateName = escapeHtml(candidate.name);

    return `
        <article class="candidate-card">
            <div class="candidate-topline">
                <div>
                    <p class="candidate-label">${escapeHtml(candidate.label)}</p>
                    <h3 class="candidate-name">${candidateName}</h3>
                </div>
                <p class="vote-count">
                    ${formatter.format(candidate.votes)}
                    <span>votes</span>
                </p>
            </div>
            <div class="vote-bar" aria-label="${candidateName} vote share">
                <div class="vote-fill ${candidate.type}" style="width: ${candidate.percent}%"></div>
            </div>
            <div class="vote-share">
                <span>${candidate.percent.toFixed(1)}% share</span>
                <span>${formatter.format(candidate.votes)} votes</span>
            </div>
        </article>
    `;
}

function renderAssembly(row) {
    const details = parseDetails(row.details);
    const totalVotes = details.winnerVotes + details.runnerVotes;
    const margin = Math.abs(details.winnerVotes - details.runnerVotes);
    const winnerPercent = totalVotes ? (details.winnerVotes / totalVotes) * 100 : 0;
    const runnerPercent = totalVotes ? (details.runnerVotes / totalVotes) * 100 : 0;

    const candidates = [
        {
            label: "Leading candidate",
            name: details.winner,
            votes: details.winnerVotes,
            percent: winnerPercent,
            type: "winner",
        },
        {
            label: "Runner up",
            name: details.runner,
            votes: details.runnerVotes,
            percent: runnerPercent,
            type: "runner",
        },
    ];

    elements.result.innerHTML = `
        <div class="result-header">
            <div>
                <p>${escapeHtml(row.zone)} / ${escapeHtml(row.loksabha)}</p>
                <h2>${escapeHtml(row.assembly)}</h2>
            </div>
            <div class="margin-pill">Margin: ${formatter.format(margin)} votes</div>
        </div>
        <div class="comparison-grid">
            ${candidates.map(candidateTemplate).join("")}
        </div>
        <div class="details-panel">
            <h3>Constituency Notes</h3>
            <pre>${escapeHtml(details.lines.join("\n"))}</pre>
        </div>
    `;
}

function resetSelect(select, placeholder) {
    fillSelect(select, [], placeholder);
    select.disabled = true;
}

function handleZoneChange() {
    const zone = elements.zone.value;
    resetSelect(elements.lokSabha, "Select Lok Sabha");
    resetSelect(elements.assembly, "Select Assembly");
    setEmptyState();

    if (!zone) {
        return;
    }

    const lokSabhaValues = uniqueValues(
        state.data.filter((item) => item.zone === zone),
        "loksabha"
    );

    fillSelect(elements.lokSabha, lokSabhaValues, "Select Lok Sabha");
    elements.lokSabha.disabled = false;
}

function handleLokSabhaChange() {
    const zone = elements.zone.value;
    const lokSabha = elements.lokSabha.value;
    resetSelect(elements.assembly, "Select Assembly");
    setEmptyState();

    if (!zone || !lokSabha) {
        return;
    }

    const assemblyValues = uniqueValues(
        state.data.filter((item) => item.zone === zone && item.loksabha === lokSabha),
        "assembly"
    );

    fillSelect(elements.assembly, assemblyValues, "Select Assembly");
    elements.assembly.disabled = false;
}

function handleAssemblyChange() {
    const zone = elements.zone.value;
    const lokSabha = elements.lokSabha.value;
    const assembly = elements.assembly.value;

    if (!assembly) {
        setEmptyState();
        return;
    }

    const row = state.data.find(
        (item) =>
            item.zone === zone &&
            item.loksabha === lokSabha &&
            item.assembly === assembly
    );

    if (!row) {
        setErrorState("No matching constituency data was found.");
        return;
    }

    renderAssembly(row);
}

async function initDashboard() {
    setLoading();

    try {
        const response = await fetch(API);

        if (!response.ok) {
            throw new Error("The election API returned an error.");
        }

        state.data = await response.json();
        fillSelect(elements.zone, uniqueValues(state.data, "zone"), "Select Zone");
        updateSummary(state.data);
        setEmptyState();
    } catch (error) {
        setErrorState(error.message || "Please check your connection and try again.");
    }
}

elements.zone.addEventListener("change", handleZoneChange);
elements.lokSabha.addEventListener("change", handleLokSabhaChange);
elements.assembly.addEventListener("change", handleAssemblyChange);

initDashboard();
