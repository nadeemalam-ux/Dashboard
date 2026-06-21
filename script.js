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
.addEventListener("change", function () {

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
.addEventListener("change", function () {

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
.addEventListener("change", function () {

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

  document.getElementById("result")
    .innerHTML = row ? row.details : "";
});