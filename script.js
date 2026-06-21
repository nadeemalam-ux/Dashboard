const API =
"https://script.google.com/macros/s/AKfycbw3h4ZkxAcvB_ox6_3OvW9iNTgFtAsuXqyaEsCBckK5_1yGHGGU3_9v8-P4M7D_wTDrlQ/exec";

let allData = [];

fetch(API)
.then(r => r.json())
.then(data => {

allData = data;

const zones =
[...new Set(data.map(x => x.zone))];

const zoneSelect =
document.getElementById("zone");

zones.forEach(z => {
zoneSelect.innerHTML +=
`<option value="${z}">${z}</option>`;
});

});

document.getElementById("zone")
.addEventListener("change", function(){

const zone = this.value;

const lsData =
allData.filter(x => x.zone === zone);

const ls =
[...new Set(lsData.map(x => x.loksabha))];

const lsSelect =
document.getElementById("ls");

lsSelect.innerHTML =
'<option value="">Select Lok Sabha</option>';

ls.forEach(item => {

lsSelect.innerHTML +=
`<option value="${item}">${item}</option>`;

});

});

document.getElementById("ls")
.addEventListener("change", function(){

const zone =
document.getElementById("zone").value;

const ls = this.value;

const asm =
allData.filter(
x => x.zone === zone &&
x.loksabha === ls
);

const assemblys =
[...new Set(asm.map(x => x.assembly))];

const assemblySelect =
document.getElementById("assembly");

assemblySelect.innerHTML =
'<option value="">Select Assembly</option>';

assemblys.forEach(item => {

assemblySelect.innerHTML +=
`<option value="${item}">${item}</option>`;

});

});

document.getElementById("assembly")
.addEventListener("change", function(){

const zone =
document.getElementById("zone").value;

const ls =
document.getElementById("ls").value;

const assembly =
this.value;

const row =
allData.find(
x => x.zone === zone &&
x.loksabha === ls &&
x.assembly === assembly
);

if(!row){
document.getElementById("result").innerHTML =
"No data found";
return;
}

const details = row.details;

const winner =
(details.match(/MLA-\s*(.*)/i) || ["","Winner"])[1];

const votes =
details.match(/Votes-\s*(\d+)/gi);

const winnerVotes =
votes && votes[0]
? parseInt(votes[0].replace(/\D/g,''))
: 0;

const runner =
(details.match(/Runner Up-\s*(.*)/i) || ["","Runner Up"])[1];

const runnerVotes =
votes && votes[1]
? parseInt(votes[1].replace(/\D/g,''))
: 0;

const total =
winnerVotes + runnerVotes;

const winnerPercent =
total ? (winnerVotes/total)*100 : 0;

const runnerPercent =
total ? (runnerVotes/total)*100 : 0;

document.getElementById("result").innerHTML = `

<div class="ac-title">${assembly}</div>

<div class="candidate">

<div class="candidate-name">
🏆 ${winner}
</div>

<div class="vote-text">
${winnerVotes.toLocaleString()} Votes
</div>

<div class="vote-bar">
<div class="vote-fill winner"
style="width:${winnerPercent}%">
${winnerPercent.toFixed(1)}%
</div>
</div>

</div>

<div class="candidate">

<div class="candidate-name">
🥈 ${runner}
</div>

<div class="vote-text">
${runnerVotes.toLocaleString()} Votes
</div>

<div class="vote-bar">
<div class="vote-fill runner"
style="width:${runnerPercent}%">
${runnerPercent.toFixed(1)}%
</div>
</div>

</div>

<div class="details">
${details.replace(/\n/g,"<br>")}
</div>

`;

});
