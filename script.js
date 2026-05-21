// CONFIGURATION
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby0Y5uoGTEwqqoXVxhIn8CdOcfsGGPx81KMFMw4rdnp3mt4iMVU7kApOsZzzD2n6arE/exec"; // Apni API URL yahan dalein
const APP_PASSWORD = "shehjaar123";

let allPatients = [];

// Date Helpers
function formatDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD Format for consistency
}

function calculateExpiryDate(days) {
  let d = new Date();
  d.setDate(d.getDate() + parseInt(days));
  return formatDate(d);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("isLoggedIn") === "true") {
    showApp();
  }

  const defaultFee = localStorage.getItem("defaultFee") || "300";
  const validityDays = localStorage.getItem("validityDays") || "15";

  document.getElementById("defaultFee").value = defaultFee;
  document.getElementById("validityDays").value = validityDays;
});

function checkLogin() {
  const passwordInput = document.getElementById("loginPassword").value;
  if (passwordInput === APP_PASSWORD) {
    sessionStorage.setItem("isLoggedIn", "true");
    showApp();
  } else {
    document.getElementById("loginError").style.display = "block";
  }
}

function showApp() {
  document.getElementById("loginOverlay").style.display = "none";
  document.getElementById("mainApp").style.display = "block";

  const cachedData = localStorage.getItem("cachedPatients");
  if (cachedData) {
    allPatients = JSON.parse(cachedData);
    renderTable(allPatients);
    updateStats(allPatients);
    updateDatalist();
  } else {
    document.getElementById("splashLoader").style.display = "flex";
  }
  fetchPatients();
}

function extractNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function updateStats(data) {
  const uniquePatients = new Set(data.map(p => p.patient_id).filter(id => id));

  let globalPending = 0;
  let globalAdvance = 0;
  let globalCollection = 0;

  const patientTotals = {};
  data.forEach(p => {
    const id = p.patient_id;
    if (!id) return;
    if (!patientTotals[id]) {
      patientTotals[id] = { fee: 0, paid: 0 };
    }

    // Ignore Visit 2 fees to prevent legacy data from inflating the true fee total
    const visitStr = String(p.visit || "").toLowerCase();
    if (!visitStr.includes("visit 2")) {
      patientTotals[id].fee += extractNumber(p.fee);
    }

    patientTotals[id].paid += extractNumber(p.paid);
    globalCollection += extractNumber(p.paid);
  });

  for (const id in patientTotals) {
    const bal = patientTotals[id].fee - patientTotals[id].paid;
    if (bal > 0) {
      globalPending += bal;
    } else if (bal < 0) {
      globalAdvance += Math.abs(bal);
    }
  }

  document.getElementById("statPatients").innerText = uniquePatients.size;
  document.getElementById("statSessions").innerText = data.length;
  document.getElementById("statPending").innerText = `₹ ${globalPending}`;
  document.getElementById("statAdvance").innerText = `₹ ${globalAdvance}`;
  document.getElementById("statCollection").innerText = `₹ ${globalCollection}`;
}

function toggleSettings() {
  const modal = document.getElementById("settingsModal");
  modal.style.display = modal.style.display === "none" ? "flex" : "none";
}

function saveSettings() {
  localStorage.setItem("defaultFee", document.getElementById("defaultFee").value);
  localStorage.setItem("validityDays", document.getElementById("validityDays").value);
  toggleSettings();

  // Update fields if empty form
  if (document.getElementById("name").value.trim() === "") {
    document.getElementById("fee").value = localStorage.getItem("defaultFee");
    document.getElementById("validUpto").value = calculateExpiryDate(localStorage.getItem("validityDays"));
  }
}

function calculateBalance() {
  const fee = parseFloat(document.getElementById("fee").value) || 0;
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  document.getElementById("balance").value = fee - paid;
}

// SMART SEARCH & HISTORY FETCH
function applyPatientHistory(lastRecord) {
  const balanceAlert = document.getElementById("balanceAlert");
  const pendingValue = document.getElementById("pendingValue");
  const advanceAlert = document.getElementById("advanceAlert");
  const advanceValue = document.getElementById("advanceValue");
  const hintEl = document.getElementById("smartHint");
  const validityDays = parseInt(localStorage.getItem("validityDays") || "15");

  document.getElementById("activePatientId").value = lastRecord.patient_id;
  document.getElementById("searchPatientId").value = lastRecord.patient_id;
  document.getElementById("name").value = lastRecord.name || "";
  document.getElementById("phone").value = lastRecord.phone || "";
  document.getElementById("address").value = lastRecord.address || "";

  // Calculate true mathematical balance dynamically
  const history = allPatients.filter(p => String(p.patient_id) === String(lastRecord.patient_id));
  let totalFee = 0;
  let totalPaid = 0;
  history.forEach(p => {
    const visitStr = String(p.visit || "").toLowerCase();
    if (!visitStr.includes("visit 2")) {
      totalFee += extractNumber(p.fee);
    }
    totalPaid += extractNumber(p.paid);
  });
  const prevBal = totalFee - totalPaid;
  document.getElementById("prevBal").value = prevBal;

  if (prevBal > 0) {
    balanceAlert.style.display = "block";
    pendingValue.innerText = prevBal;
    if (advanceAlert) advanceAlert.style.display = "none";
  } else if (prevBal < 0) {
    if (advanceAlert) {
      advanceAlert.style.display = "block";
      advanceValue.innerText = Math.abs(prevBal);
    }
    balanceAlert.style.display = "none";
  } else {
    balanceAlert.style.display = "none";
    if (advanceAlert) advanceAlert.style.display = "none";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDateStr = lastRecord.checkup_duration_validity || lastRecord.duration;
  const expiryDate = new Date(expiryDateStr);
  const isExpired = today > expiryDate || isNaN(expiryDate.getTime());

  // Valid Session for Visit 2
  if (!isExpired && lastRecord.visit === "Visit 1") {
    document.getElementById("activeCheckupId").value = lastRecord.checkup_id;
    document.getElementById("displayCheckupId").value = lastRecord.checkup_id;
    document.getElementById("visit").value = "Visit 2";
    document.getElementById("validUpto").value = expiryDateStr; // Same expiry
    document.getElementById("fee").value = 0; // Visit 2 is free

    hintEl.style.display = "block";
    hintEl.innerHTML = `✅ ID: ${lastRecord.checkup_id} - Session Valid till ${expiryDateStr}. Proceed to Visit 2.`;
  }
  // Expired or New Cycle
  else {
    document.getElementById("activeCheckupId").value = "";
    document.getElementById("displayCheckupId").value = "Auto (New)";
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("validUpto").value = calculateExpiryDate(validityDays);
    document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";

    hintEl.style.display = "block";
    if (isExpired && lastRecord.visit === "Visit 1") {
      hintEl.innerHTML = `⚠️ Previous checkup expired on ${expiryDateStr}. Starting new checkup cycle.`;
    } else {
      hintEl.innerHTML = `🆕 Previous checkup cycle complete. Starting new  checkup cycle.`;
    }
  }
}

function handleIdInput() {
  const inputId = document.getElementById("searchPatientId").value.trim();
  if (inputId === "") {
    document.getElementById("activePatientId").value = "";
    document.getElementById("activeCheckupId").value = "";
    document.getElementById("displayCheckupId").value = "Auto (New)";
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("smartHint").style.display = "none";
    document.getElementById("prevBal").value = 0;
    const advanceAlert = document.getElementById("advanceAlert");
    if (advanceAlert) advanceAlert.style.display = "none";
    return;
  }
  const history = allPatients.filter(p => String(p.patient_id) === inputId);
  if (history.length > 0) {
    applyPatientHistory(history[0]);
  } else {
    document.getElementById("activePatientId").value = inputId;
    document.getElementById("activeCheckupId").value = "";
    document.getElementById("displayCheckupId").value = "Auto (New)";
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("smartHint").style.display = "none";
    document.getElementById("prevBal").value = 0;
    document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
    document.getElementById("validUpto").value = calculateExpiryDate(parseInt(localStorage.getItem("validityDays") || "15"));
    document.getElementById("balanceAlert").style.display = "none";
    const advanceAlert = document.getElementById("advanceAlert");
    if (advanceAlert) advanceAlert.style.display = "none";
  }
  calculateBalance();
}

async function handleNameInput() {
  const inputName = document.getElementById("name").value.trim().toLowerCase();
  if (inputName.length < 2) { return; }

  const history = allPatients.filter(p => p.name && p.name.toLowerCase() === inputName);
  if (history.length > 0) {
    const currentId = document.getElementById("searchPatientId").value.trim();
    if (currentId === "") {
      applyPatientHistory(history[0]);
    }
  }
  calculateBalance();
}

async function fetchPatients() {
  const statusEl = document.getElementById("connectionStatus");
  statusEl.innerHTML = `<span class="dot" style="color: rgba(255,255,255,0.5);">●</span> Syncing...`;
  statusEl.style.color = "rgba(255, 255, 255, 0.8)";
  try {
    const response = await fetch(WEB_APP_URL);
    const data = await response.json();
    allPatients = data.reverse(); // Newest entries at the top
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    updateStats(allPatients);
    statusEl.innerHTML = `<span class="dot">●</span> Connected with Cloud database <i class="fas fa-cloud" style="margin-left:4px; font-size:14px;"></i>`;
    statusEl.style.color = "#ffffff";
    updateDatalist();
  } catch (error) {
    console.error("Error:", error);
    statusEl.innerHTML = `<span class="dot" style="color: #ef4444;">●</span> Connection Failed <i class="fas fa-exclamation-triangle" style="margin-left:4px;"></i>`;
    statusEl.style.color = "#fca5a5";
  } finally {
    const loader = document.getElementById("splashLoader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => {
        loader.style.display = "none";
        loader.style.opacity = "1";
      }, 500);
    }
  }
}

async function addPatient() {
  const name = document.getElementById("name").value;
  const patientId = document.getElementById("activePatientId").value;
  const checkupId = document.getElementById("activeCheckupId").value;

  let finalPatientId = patientId;
  let finalCheckupId = checkupId;

  if (finalPatientId === "") {
    finalPatientId = allPatients.length > 0 ? (Math.max(...allPatients.map(p => parseInt(p.patient_id) || 0)) + 1) : 1;
  }
  if (finalCheckupId === "") {
    const patientHistory = allPatients.filter(p => String(p.patient_id) === String(finalPatientId));
    finalCheckupId = patientHistory.length > 0 ? (Math.max(...patientHistory.map(p => parseInt(p.checkup_id) || 0)) + 1) : 1;
  }

  const patientData = {
    patient_id: finalPatientId,
    checkup_id: finalCheckupId,
    date: formatDate(new Date()),
    name: name,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    visit: document.getElementById("visit").value,
    fee: parseFloat(document.getElementById("fee").value) || 0,
    paid: parseFloat(document.getElementById("paid").value) || 0,
    balance: parseFloat(document.getElementById("balance").value) || 0,
    status: (parseFloat(document.getElementById("balance").value) || 0) > 0 ? "Pending" : ((parseFloat(document.getElementById("balance").value) || 0) < 0 ? "Advance" : "Done"),
    duration: document.getElementById("validUpto").value, // Matches App Script insertion
    action: "add"
  };

  try {
    document.getElementById("btnText").style.display = "none";
    document.getElementById("btnLoader").style.display = "block";
    document.getElementById("submitBtn").disabled = true;

    // Optimistic UI Update
    allPatients.unshift(patientData); // Always add to top since we don't overwrite anymore
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    updateStats(allPatients);

    // Asynchronous background sync
    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData)
    }).then(() => {
      fetchPatients();
    }).catch(error => {
      console.error("Save failed:", error);
    });

    setTimeout(() => {
      clearForm();
      document.getElementById("btnText").style.display = "block";
      document.getElementById("btnLoader").style.display = "none";
      document.getElementById("submitBtn").disabled = false;
    }, 500);
  } catch (error) {
    console.error("Save failed locally:", error);
  }
}

async function deletePatient(patientId, checkupId, visit) {
  if (!confirm("Are you sure you want to delete this session?")) return;

  // Optimistic UI Update
  allPatients = allPatients.filter(p => !(String(p.patient_id) === String(patientId) && String(p.checkup_id) === String(checkupId) && p.visit === visit));
  localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
  renderTable(allPatients);
  updateStats(allPatients);

  try {
    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", patient_id: patientId, checkup_id: checkupId, visit: visit })
    }).then(() => fetchPatients());
  } catch (error) {
    console.error("Delete failed:", error);
  }
}

function renderTable(data) {
  const tableBody = document.getElementById("patientTableBody");
  tableBody.innerHTML = "";
  if (data.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center; padding:30px; color:#7f8c8d;'>No sessions found.</td></tr>";
    return;
  }
  data.forEach((p, index) => {
    const bal = parseFloat(p.balance) || 0;
    const isPending = bal > 0;
    const isAdvance = bal < 0;
    const badgeClass = isPending ? 'status-pending' : (isAdvance ? 'status-advance' : 'status-done');
    const balColor = isPending ? '#e74c3c' : (isAdvance ? '#2b6cb0' : '#27ae60');

    const row = document.createElement("tr");
    row.className = "optimistic-row";
    setTimeout(() => { row.classList.remove("optimistic-row"); }, 500);

    row.innerHTML = `
      <td>${p.patient_id}</td>
      <td>${p.checkup_id}</td>
      <td>${p.date || '-'}</td>
      <td style="font-weight: 600;">${p.name}</td>
      <td>${p.phone}</td>
      <td>${p.address || '-'}</td>
      <td>${p.visit}</td>
      <td>₹ ${p.fee}</td>
      <td>₹ ${p.paid}</td>
      <td style="font-weight: 700; color: ${balColor}">₹ ${p.balance}</td>
      <td>${p.checkup_duration_validity || p.duration || '-'}</td>
      <td><span class="status-badge ${badgeClass}">${p.status}</span></td>
      <td>
        <button class="btn" style="background: #fff5f5; color: #c53030; padding: 5px 10px;" onclick="event.stopPropagation(); deletePatient(${p.patient_id}, ${p.checkup_id}, '${p.visit}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function clearForm(keepId = false) {
  document.getElementById("patientForm").reset();
  if (!keepId) {
    document.getElementById("searchPatientId").value = "";
  }
  document.getElementById("displayCheckupId").value = "";
  document.getElementById("activePatientId").value = "";
  document.getElementById("activeCheckupId").value = "";
  document.getElementById("balanceAlert").style.display = "none";
  const advanceAlert = document.getElementById("advanceAlert");
  if (advanceAlert) advanceAlert.style.display = "none";
  document.getElementById("smartHint").style.display = "none";

  // Reset Default Values
  document.getElementById("visit").value = "Visit 1";
  document.getElementById("prevBal").value = 0;
  document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
  document.getElementById("validUpto").value = calculateExpiryDate(localStorage.getItem("validityDays") || "15");
}

function updateDatalist() {
  const names = [...new Set(allPatients.map(p => p.name))];
  const dl = document.getElementById("patientSuggestions");
  dl.innerHTML = "";
  names.forEach(n => { if (n) dl.innerHTML += `<option value="${n}">`; });
}

function applyFilters() {
  const fId = document.getElementById("filterPatId").value.trim().toLowerCase();
  const fChkId = document.getElementById("filterChkId").value.trim().toLowerCase();
  const fDate = document.getElementById("filterDate").value;
  const fName = document.getElementById("filterName").value.trim().toLowerCase();
  const fPhone = document.getElementById("filterPhone").value.trim().toLowerCase();

  const filtered = allPatients.filter(p => {
    const matchId = fId === "" || String(p.patient_id).toLowerCase() === fId;
    const matchChkId = fChkId === "" || String(p.checkup_id).toLowerCase() === fChkId;
    const matchDate = fDate === "" || String(p.date) === fDate;
    const matchName = fName === "" || String(p.name).toLowerCase().includes(fName);
    const matchPhone = fPhone === "" || String(p.phone).toLowerCase().includes(fPhone);
    return matchId && matchChkId && matchDate && matchName && matchPhone;
  });
  renderTable(filtered);
}

function resetFilters() {
  document.getElementById("filterPatId").value = "";
  document.getElementById("filterChkId").value = "";
  document.getElementById("filterDate").value = "";
  document.getElementById("filterName").value = "";
  document.getElementById("filterPhone").value = "";
  renderTable(allPatients);
}

// Toggle stats grid visibility
function toggleStatsGrid() {
  const grid = document.getElementById("statsGrid");
  const icon = document.getElementById("statsToggleIcon");
  if (grid.classList.contains("hidden")) {
    grid.classList.remove("hidden");
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  } else {
    grid.classList.add("hidden");
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  }
}