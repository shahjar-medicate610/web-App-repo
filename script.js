// CONFIGURATION
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz9Yv4xD7rojugffj6iclfeM3xTqds4p__hH3PIUDF8SQX8y1sD-mEIePytWlBk2G8X/exec";
// NOTE: Password is verified server-side only — never stored in this file.

// Simple brute-force protection (client-side aid)
let _loginAttempts = 0;
let _loginLockedUntil = 0;

let allPatients = [];
let isPreviewMode = true; // true = Patient ID field shows next auto-generated preview ID

// Override Native Alert with Custom Sweet Popup
window.alert = function(message) {
  document.getElementById('customAlertMessage').innerText = message;
  const modal = document.getElementById('customAlertModal');
  const box = document.getElementById('customAlertBox');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    box.style.transform = 'scale(1)';
  }, 10);
};

function closeCustomAlert() {
  const modal = document.getElementById('customAlertModal');
  const box = document.getElementById('customAlertBox');
  modal.style.opacity = '0';
  box.style.transform = 'scale(0.9)';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

// Override Native Confirm with Custom Sweet Popup (Async)
window.customConfirmAsync = function(message) {
  return new Promise((resolve) => {
    document.getElementById('customConfirmMessage').innerText = message;
    const modal = document.getElementById('customConfirmModal');
    const box = document.getElementById('customConfirmBox');
    
    const btnCancel = document.getElementById('btnCustomConfirmCancel');
    const btnOk = document.getElementById('btnCustomConfirmOk');
    
    const cleanup = () => {
      btnCancel.onclick = null;
      btnOk.onclick = null;
      modal.style.opacity = '0';
      box.style.transform = 'scale(0.9)';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };

    btnOk.onclick = () => {
      cleanup();
      resolve(true);
    };

    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      box.style.transform = 'scale(1)';
    }, 10);
  });
};

// Custom Prompt Popup (Async)
window.customPromptAsync = function(message) {
  return new Promise((resolve) => {
    document.getElementById('customPromptMessage').innerText = message;
    const modal = document.getElementById('customPromptModal');
    const box = document.getElementById('customPromptBox');
    const input = document.getElementById('customPromptInput');
    
    input.value = '';
    
    const btnCancel = document.getElementById('btnCustomPromptCancel');
    const btnOk = document.getElementById('btnCustomPromptOk');
    
    const cleanup = () => {
      btnCancel.onclick = null;
      btnOk.onclick = null;
      input.onkeydown = null;
      modal.style.opacity = '0';
      box.style.transform = 'scale(0.9)';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(null);
    };

    btnOk.onclick = () => {
      cleanup();
      resolve(input.value);
    };

    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      box.style.transform = 'scale(1)';
      input.focus();
    }, 10);
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        btnOk.click();
      }
    };
  });
};

// Custom Behavior Prompt Popup (Async)
window.behaviorPromptAsync = function(message) {
  return new Promise((resolve) => {
    document.getElementById('behaviorPromptMessage').innerText = message;
    const modal = document.getElementById('behaviorPromptModal');
    const box = document.getElementById('behaviorPromptBox');
    const input = document.getElementById('behaviorPromptInput');
    
    input.value = '';
    
    const btnCancel = document.getElementById('btnBehaviorPromptCancel');
    const btnOk = document.getElementById('btnBehaviorPromptOk');
    
    const cleanup = () => {
      btnCancel.onclick = null;
      btnOk.onclick = null;
      input.onkeydown = null;
      modal.style.opacity = '0';
      box.style.transform = 'scale(0.9)';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(null);
    };

    btnOk.onclick = () => {
      cleanup();
      resolve(input.value);
    };

    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      box.style.transform = 'scale(1)';
      input.focus();
    }, 10);
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        btnOk.click();
      }
    };
  });
};

// Pagination State
let currentPage = 1;
const rowsPerPage = 100;
let currentDataset = [];

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

// Flatpickr Calendar Variables
let dateEntryCounts = {};
let obsFlatpickrInstance = null;

function updateDateEntryCounts(data) {
  dateEntryCounts = {};
  data.forEach(p => {
    // Ignore empty/invalid rows
    if (!p.patient_id && !p.checkup_id && parseFloat(p.payment_by_shehjar || 0) <= 0) return;
    
    // Ignore Doctor Settlements (as they are not patient entries)
    const isSettlement = parseFloat(p.payment_by_shehjar || 0) > 0 && (!p.patient_id || String(p.patient_id).trim() === "");
    if (isSettlement) return;

    const isPharmacy = String(p.status || "").includes("Pharmacy / Payment") || String(p.visit || "").includes("Pharmacy / Payment");
    
    let pDateStr = p.date;
    if (p.date) {
      const parsedDate = new Date(p.date);
      if (!isNaN(parsedDate)) {
        pDateStr = formatDate(parsedDate);
      }
    }
    
    if (pDateStr) {
      if (!dateEntryCounts[pDateStr]) {
         dateEntryCounts[pDateStr] = { total: 0, checkups: 0, pharmacy: 0 };
      }
      dateEntryCounts[pDateStr].total++;
      if (isPharmacy) {
        dateEntryCounts[pDateStr].pharmacy++;
      } else {
        dateEntryCounts[pDateStr].checkups++;
      }
    }
  });

  // Re-draw flatpickr to show badges if instance exists
  if (obsFlatpickrInstance) {
    obsFlatpickrInstance.redraw();
  }
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

  // Initialize Flatpickr for Date Filter
  obsFlatpickrInstance = flatpickr("#obsDateFilter", {
    dateFormat: "Y-m-d",
    onChange: function(selectedDates, dateStr, instance) {
      renderObservationList(allPatients);
    },
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      if (dayElem.dateObj) {
        const dateStrFormat = formatDate(dayElem.dateObj);
        const counts = dateEntryCounts[dateStrFormat];
        if (counts && counts.total > 0) {
          // Highlight day base styles
          dayElem.style.position = 'relative';
          dayElem.style.fontWeight = 'bold';
          dayElem.style.color = '#fff';
          dayElem.style.border = 'none';
          dayElem.style.transform = 'scale(0.85)';
          
          // Let Flatpickr keep its default circular border-radius
          dayElem.style.borderRadius = '50%';

          // Assign Colors based on Entry Types
          if (counts.checkups > 0 && counts.pharmacy > 0) {
            // Both checkups and pharmacy
            dayElem.style.background = 'linear-gradient(135deg, #14b8a6 50%, #8b5cf6 50%)'; // Teal & Purple Split
          } else if (counts.checkups > 0) {
            // Only Checkups
            dayElem.style.backgroundColor = '#14b8a6'; // Teal
          } else {
            // Only Pharmacy/Payment
            dayElem.style.backgroundColor = '#8b5cf6'; // Purple
          }

          // Add Count Badge
          const badge = document.createElement('span');
          badge.innerHTML = counts.total;
          badge.style.position = 'absolute';
          badge.style.top = '-2px';
          badge.style.right = '-2px';
          badge.style.width = '14px';
          badge.style.height = '14px';
          badge.style.display = 'flex';
          badge.style.alignItems = 'center';
          badge.style.justifyContent = 'center';
          badge.style.background = '#f59e0b'; // Amber badge
          badge.style.color = 'white';
          badge.style.borderRadius = '50%';
          badge.style.fontSize = '9px';
          badge.style.fontWeight = 'bold';
          badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
          badge.style.pointerEvents = 'none'; // Prevents badge from messing up hover/click events
          dayElem.appendChild(badge);
        }
      }
    }
  });

  // Smart Align Inputs UX (Left default, Right on active/typing)
  document.addEventListener("focusin", function(e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "hidden") {
      e.target.classList.add("right-aligned");
    }
  });

  document.addEventListener("focusout", function(e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "hidden") {
      if (!e.target.value || e.target.value === "0" || e.target.value == 0) {
        e.target.classList.remove("right-aligned");
      } else {
        e.target.classList.add("right-aligned");
      }
    }
  });

  document.addEventListener("input", function(e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "hidden") {
      e.target.classList.add("right-aligned");
    }
  });
});

async function checkLogin() {
  const now = Date.now();
  
  // Brute-force lockout check
  if (_loginLockedUntil > now) {
    const secsLeft = Math.ceil((_loginLockedUntil - now) / 1000);
    document.getElementById("loginError").style.display = "block";
    document.getElementById("loginError").innerText = `⏳ Too many attempts. Wait ${secsLeft} seconds.`;
    return;
  }

  const passwordInput = document.getElementById("loginPassword").value.trim();
  if (!passwordInput) return;

  // Show loading state
  const loginBtn = document.querySelector('#loginOverlay .btn-primary');
  const originalText = loginBtn ? loginBtn.innerText : '';
  if (loginBtn) { loginBtn.innerText = '🔐 Verifying...'; loginBtn.disabled = true; }
  document.getElementById("loginError").style.display = "none";

  try {
    // Send password to server for verification — password never stored in this file
    const response = await fetch(`${WEB_APP_URL}?action=verifyPassword&pwd=${encodeURIComponent(passwordInput)}`);
    const result = await response.json();

    if (result.success === true) {
      _loginAttempts = 0;
      sessionStorage.setItem("isLoggedIn", "true");
      showApp();
    } else {
      _loginAttempts++;
      if (_loginAttempts >= 5) {
        _loginLockedUntil = Date.now() + 30000; // Lock for 30 seconds
        _loginAttempts = 0;
      }
      document.getElementById("loginError").style.display = "block";
      document.getElementById("loginError").innerText = '❌ Incorrect Password';
    }
  } catch (err) {
    // Fallback: if server unreachable, block login (security > convenience)
    document.getElementById("loginError").style.display = "block";
    document.getElementById("loginError").innerText = '⚠️ Cannot verify. Check internet connection.';
  } finally {
    if (loginBtn) { loginBtn.innerText = originalText; loginBtn.disabled = false; }
  }
}

function showApp() {
  document.getElementById("loginOverlay").style.display = "none";
  document.getElementById("mainApp").style.display = "block";

  // Initialize form defaults on every app load (browser refresh fix)
  document.getElementById("visit").value = "Visit 1";
  document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
  document.getElementById("validUpto").value = calculateExpiryDate(localStorage.getItem("validityDays") || "15");

  // Populate doctors dropdown
  populateDoctorsDropdown();

  // Restore settings modal values
  document.getElementById("defaultFee").value = localStorage.getItem("defaultFee") || "300";
  document.getElementById("validityDays").value = localStorage.getItem("validityDays") || "15";
  document.getElementById("doctorsList").value = localStorage.getItem("doctorsList") || "";

  const cachedData = localStorage.getItem("cachedPatients");
  if (cachedData) {
    allPatients = JSON.parse(cachedData);
    renderTable(allPatients);
    updateStats(allPatients);
    updateDatalist();
    refreshPreviewIds();
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

  let globalTotalFee = 0;
  let globalCollection = 0;

  data.forEach(p => {
    globalTotalFee += extractNumber(p.fee);
    globalTotalFee += extractNumber(p.medicine_fee);

    // Collection includes all payments
    globalCollection += extractNumber(p.paid);
    globalCollection += extractNumber(p.medicine_paid);
  });

  const netBalance = globalTotalFee - globalCollection;
  
  let globalPending = 0;
  let globalAdvance = 0;

  if (netBalance > 0) {
    globalPending = netBalance;
  } else if (netBalance < 0) {
    globalAdvance = Math.abs(netBalance);
  }

  document.getElementById("statPatients").innerText = uniquePatients.size;
  if (document.getElementById("statTotalAmount")) {
    document.getElementById("statTotalAmount").innerText = `₹ ${globalTotalFee}`;
  }
  document.getElementById("statPending").innerText = `₹ ${globalPending}`;
  document.getElementById("statAdvance").innerText = `₹ ${globalAdvance}`;
  document.getElementById("statCollection").innerText = `₹ ${globalCollection}`;

  updateDateEntryCounts(data);
  renderObservationList(data);
}

function renderObservationList(data) {
  const listEl = document.getElementById("observationPatientsList");
  const countEl = document.getElementById("obsCount");
  const dateFilterEl = document.getElementById("obsDateFilter");
  if (!listEl || !countEl) return;

  if (dateFilterEl && !dateFilterEl.value) {
    dateFilterEl.value = formatDate(new Date());
  }

  const targetDateStr = dateFilterEl ? dateFilterEl.value : formatDate(new Date());

  // Populate doctor filter dropdown dynamically
  const obsDoctorFilterEl = document.getElementById("obsDoctorFilter");
  if (obsDoctorFilterEl) {
    const currentDocFilter = obsDoctorFilterEl.value;
    const doctorsOnDate = [...new Set(
      data
        .filter(p => {
          if (!p.checkup_id || String(p.checkup_id).trim() === "") return false;
          let pDateStr = p.date;
          if (p.date) {
            const parsedDate = new Date(p.date);
            if (!isNaN(parsedDate)) pDateStr = formatDate(parsedDate);
          }
          return pDateStr === targetDateStr && p.doctor && p.doctor.trim() !== "";
        })
        .map(p => p.doctor.trim())
    )].sort();
    
    obsDoctorFilterEl.innerHTML = `<option value="">All Doctors</option>`;
    doctorsOnDate.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc;
      opt.textContent = doc;
      if (doc === currentDocFilter) opt.selected = true;
      obsDoctorFilterEl.appendChild(opt);
    });
    // Restore filter value if it still exists
    if (currentDocFilter && doctorsOnDate.includes(currentDocFilter)) {
      obsDoctorFilterEl.value = currentDocFilter;
    }
  }

  const selectedDoctorFilter = obsDoctorFilterEl ? obsDoctorFilterEl.value.trim() : "";

  // Show all patients for the selected date, robustly parsing date
  const obsPatients = data.filter(p => {
    // Exclude empty rows, doctor settlements, or direct patient tally payments (which lack checkup_id/token_no)
    if (!p.checkup_id || String(p.checkup_id).trim() === "") return false;
    
    // Exclude 'Pharmacy / Payment' entries
    if (String(p.status || "").includes("Pharmacy / Payment") || String(p.visit || "").includes("Pharmacy / Payment")) return false;
    
    let pDateStr = p.date;
    if (p.date) {
      const parsedDate = new Date(p.date);
      if (!isNaN(parsedDate)) {
        pDateStr = formatDate(parsedDate);
      }
    }
    if (pDateStr !== targetDateStr) return false;

    // Apply doctor filter
    if (selectedDoctorFilter !== "") {
      if ((p.doctor || "").trim() !== selectedDoctorFilter) return false;
    }

    return true;
  });

  // Sort: first by doctor name, then by token number within each doctor
  obsPatients.sort((a, b) => {
    const docA = (a.doctor || "").trim().toLowerCase();
    const docB = (b.doctor || "").trim().toLowerCase();
    if (docA < docB) return -1;
    if (docA > docB) return 1;
    const t1 = parseInt(a.token_no) || 999999;
    const t2 = parseInt(b.token_no) || 999999;
    return t1 - t2;
  });

  const paidFilterEl = document.getElementById("obsPaidFilter");
  const paidFilterVal = paidFilterEl ? paidFilterEl.value : "all";
  
  let finalObsPatients = obsPatients.filter(p => {
    if (paidFilterVal === "all") return true;
    const visitStr = String(p.visit || "").toLowerCase().trim();
    const hasVisit1 = visitStr.includes("visit 1") || visitStr.includes("visit1");
    const isExtra = visitStr.includes("extra");
    
    if (paidFilterVal === "paid") return hasVisit1 && !isExtra;
    if (paidFilterVal === "free") return !hasVisit1 || isExtra;
    return true;
  });

  countEl.innerText = finalObsPatients.length;
  
  let totalPaidForDay = 0;
  finalObsPatients.forEach(p => {
    totalPaidForDay += parseFloat(p.paid) || 0;
  });
  
  const totalPaidEl = document.getElementById("obsTotalPaid");
  if (totalPaidEl) {
    totalPaidEl.innerText = `₹ ${totalPaidForDay}`;
  }

  if (finalObsPatients.length === 0) {
    listEl.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #64748b; padding: 20px; font-weight: 600;">No records found for the selected filters.</td></tr>`;
    return;
  }

  let html = "";
  let lastDoctor = null;
  finalObsPatients.forEach((p, index) => {
    const bal = parseFloat(p.balance) || 0;
    const isPending = bal > 0;
    const isAdvance = bal < 0;
    // Parse behavior from status: "Left Clinic (Bad)" → cleanStatus="Left Clinic", behavior="Bad"
    const rawStatus = String(p.status || "");
    // Match both "(Good|Bad)" and "(Good|Bad: reason)"
    const behMatch = rawStatus.match(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/);
    const obsCleanStatus = behMatch ? rawStatus.replace(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/, "").trim() : rawStatus;
    const obsBehavior = behMatch ? behMatch[2] : null;

    let badgeClass;
    if (obsCleanStatus.includes("Pharmacy / Payment")) badgeClass = 'status-payment';
    else if (obsCleanStatus === "Left Clinic") badgeClass = 'status-left-clinic';
    else if (obsCleanStatus === "Refunded-->Extra-visit") badgeClass = 'status-refunded';
    else if (obsCleanStatus === "Under Observation") badgeClass = 'status-observation';
    else if (isPending) badgeClass = 'status-pending';
    else if (isAdvance) badgeClass = 'status-advance';
    else badgeClass = 'status-done';
    
    let rowStyle = (obsCleanStatus === "Left Clinic") ? "background-color: #bbf7d0;" : "";
    if (obsBehavior === "Bad") rowStyle = "background-color: #fecaca; color: #7f1d1d;";

    // Insert a doctor separator row when doctor changes (only when showing all doctors)
    const currentDoctor = (p.doctor || "").trim();
    if (selectedDoctorFilter === "" && currentDoctor !== lastDoctor) {
      const docColor = getDoctorColor(currentDoctor);
      html += `
        <tr>
          <td colspan="13" style="background: ${docColor.bg}; color: ${docColor.text}; font-weight: 900; font-size: 13px; padding: 6px 14px; border-top: 2px solid ${docColor.border}; border-bottom: 2px solid ${docColor.border}; letter-spacing: 0.5px;">
            <i class="fas fa-user-md" style="margin-right: 6px;"></i>${currentDoctor || 'Unknown Doctor'} — Patients
          </td>
        </tr>
      `;
      lastDoctor = currentDoctor;
    }
    
    html += `
      <tr style="${rowStyle}">
        <td style="background: #fffbeb; text-align: center; border-right: 1px solid #fde68a;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; font-weight: 900; font-size: 12px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.4); border: 2px solid #fff; margin: auto;">
            ${p.token_no || '-'}
          </div>
        </td>
        <td style="font-family: monospace; font-weight: 800; color: #1e293b;">${p.patient_id || '-'}</td>
        <td style="font-family: monospace; font-weight: 800; color: #475569;">${p.checkup_id || '-'}</td>
        <td>${p.date || '-'}</td>
        <td style="font-weight: 700; color: #0f172a;">${p.name || '-'}</td>
        <td style="font-weight: 600; color: #334155;">${p.phone || '-'}</td>
        <td>${p.address || '-'}</td>
        <td style="font-weight: 700; color: #0f766e;">${p.doctor || '-'}</td>
        <td style="font-weight: 600; color: #b45309;">${p.visit || '-'}</td>
        <td style="font-weight: 600; color: #15803d;">₹ ${p.paid || '0'}</td>
        <td>${p.checkup_duration_validity || p.duration || '-'}</td>
        <td><span class="status-badge ${badgeClass}">${p.status || '-'}</span></td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button type="button" class="btn" style="background: #e0f2fe; color: #0284c7; padding: 5px 10px; border-radius: 4px; border: none; cursor: pointer;" onclick="event.stopPropagation(); editPatient('${p.patient_id}', '${p.checkup_id}', '${p.visit}')" title="Edit Session">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn" style="background: #fff5f5; color: #c53030; padding: 5px 10px; border-radius: 4px; border: none; cursor: pointer;" onclick="event.stopPropagation(); deletePatient(${p.row_index || 'null'}, '${p.patient_id || ''}', '${p.checkup_id || ''}', '${p.visit || ''}')" title="Delete Session">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  listEl.innerHTML = html;
}

// Helper: Assign a color theme per doctor name consistently
function getDoctorColor(doctorName) {
  const colors = [
    { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
    { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
    { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
    { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  ];
  if (!doctorName) return colors[0];
  let hash = 0;
  for (let i = 0; i < doctorName.length; i++) hash = doctorName.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function toggleSettings() {
  const modal = document.getElementById("settingsModal");
  modal.style.display = modal.style.display === "none" ? "flex" : "none";
}

function saveSettings() {
  localStorage.setItem("defaultFee", document.getElementById("defaultFee").value);
  localStorage.setItem("validityDays", document.getElementById("validityDays").value);
  localStorage.setItem("doctorsList", document.getElementById("doctorsList").value);
  populateDoctorsDropdown();
  toggleSettings();

  // Update fields if empty form
  if (document.getElementById("name").value.trim() === "") {
    document.getElementById("fee").value = localStorage.getItem("defaultFee");
    document.getElementById("validUpto").value = calculateExpiryDate(localStorage.getItem("validityDays"));
  }
}

function populateDoctorsDropdown(selectedDoctor = "") {
  const raw = localStorage.getItem("doctorsList") || "";
  const doctors = raw.split(",").map(d => d.trim()).filter(d => d);
  const sel = document.getElementById("doctor");
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Select Doctor --</option>`;
  doctors.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    if (d === selectedDoctor) opt.selected = true;
    sel.appendChild(opt);
  });
}

function setDoctorPaidStatus(isPaid) {
  uncheckObservation();
  const feeInput = document.getElementById("fee");
  const paidInput = document.getElementById("paid");
  
  if (isPaid) {
    paidInput.value = feeInput.value || 0;
  } else {
    paidInput.value = 0;
  }
  calculateBalance();
}

function setMedicinePaidStatus(isPaid) {
  uncheckObservation();
  const prevMed = parseFloat(document.getElementById("prevMedBal").value) || 0;
  const mFee = parseFloat(document.getElementById("medicineFee").value) || 0;
  const paidInput = document.getElementById("medicinePaid");
  
  if (isPaid) {
    paidInput.value = prevMed + mFee;
  } else {
    paidInput.value = 0;
  }
  calculateMedicineBalance();
}

function calculateBalance() {
  const prevBal = parseFloat(document.getElementById("prevBal").value) || 0;
  const fee = parseFloat(document.getElementById("fee").value) || 0;
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  document.getElementById("balance").value = prevBal + fee - paid;
}

function calculateMedicineBalance() {
  const prevMed = parseFloat(document.getElementById("prevMedBal").value) || 0;
  const mFee = parseFloat(document.getElementById("medicineFee").value) || 0;
  const mPaid = parseFloat(document.getElementById("medicinePaid").value) || 0;
  // Final = Previous pending + Today's amount - Today's paid
  document.getElementById("medicineBalance").value = prevMed + mFee - mPaid;
}

// SMART SEARCH & HISTORY FETCH
function applyPatientHistory(lastRecord) {
  isPreviewMode = false;
  showPatientBadge("old");
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

  // Auto-select last used doctor for this patient
  const patientHistory = allPatients.filter(p => String(p.patient_id) === String(lastRecord.patient_id));
  const lastWithDoctor = patientHistory.find(p => p.doctor && p.doctor.trim() !== "");
  populateDoctorsDropdown(lastWithDoctor ? lastWithDoctor.doctor : "");

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

  // Previous medicine balance
  let totalMedFee = 0;
  let totalMedPaid = 0;
  history.forEach(p => {
    totalMedFee += extractNumber(p.medicine_fee);
    totalMedPaid += extractNumber(p.medicine_paid);
  });
  const prevMedBal = totalMedFee - totalMedPaid;
  const medBalAlert = document.getElementById("medBalanceAlert");
  const medPendingValue = document.getElementById("medPendingValue");
  if (prevMedBal > 0 && medBalAlert) {
    medBalAlert.style.display = "block";
    medPendingValue.innerText = prevMedBal;
  } else if (medBalAlert) {
    medBalAlert.style.display = "none";
  }
  // Set prevMedBal field and clear today's medicine fields
  document.getElementById("prevMedBal").value = prevMedBal > 0 ? prevMedBal : 0;
  document.getElementById("medicineFee").value = "";
  document.getElementById("medicinePaid").value = "";
  document.getElementById("medicineBalance").value = prevMedBal > 0 ? prevMedBal : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent record that is NOT a payment entry
  let lastCheckupRecord = null;
  for (let p of patientHistory) {
    if (!String(p.status || "").includes("Pharmacy / Payment") && !String(p.visit || "").includes("Pharmacy / Payment")) {
      lastCheckupRecord = p;
      break;
    }
  }
  lastCheckupRecord = lastCheckupRecord || lastRecord; // Fallback

  let expiryDateStr = lastCheckupRecord.checkup_duration_validity || lastCheckupRecord.duration;
  let expiryDate = new Date(expiryDateStr);
  let isExpired = today > expiryDate || isNaN(expiryDate.getTime());

  const rawStatus = String(lastCheckupRecord.status || "");
  const cleanStatus = rawStatus.replace(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/, "").trim();

  // Find the last COMPLETED record to determine the cycle state robustly
  let lastCompletedRecord = null;
  for (let p of patientHistory) {
    const pSt = String(p.status || "").replace(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/, "").trim();
    if (pSt !== "Left Without Checkup" && pSt !== "Under Observation" && pSt !== "Registered" && !pSt.includes("Pharmacy / Payment")) {
      lastCompletedRecord = p;
      break;
    }
  }

  // Fallback to lastCheckupRecord if they never completed a visit
  const referenceRecord = lastCompletedRecord || lastCheckupRecord;

  expiryDateStr = referenceRecord.checkup_duration_validity || referenceRecord.duration;
  expiryDate = new Date(expiryDateStr);
  isExpired = today > expiryDate || isNaN(expiryDate.getTime());

  // If they left without checkup, dynamically determine which visit they were supposed to be on
  if (cleanStatus === "Left Without Checkup") {
    if (lastCompletedRecord && !isExpired && lastCompletedRecord.visit === "Visit 1") {
      document.getElementById("activeCheckupId").value = lastCompletedRecord.checkup_id || "";
      document.getElementById("displayCheckupId").value = lastCompletedRecord.checkup_id || "";
      document.getElementById("visit").value = "Visit 2";
      document.getElementById("validUpto").value = expiryDateStr;
      document.getElementById("fee").value = 0;
      hintEl.style.display = "block";
      hintEl.innerHTML = `ℹ️ Resuming Visit 2 (Previously Left Without Treatment).`;
    } else {
      document.getElementById("activeCheckupId").value = lastCheckupRecord.checkup_id || "";
      document.getElementById("displayCheckupId").value = lastCheckupRecord.checkup_id || "";
      document.getElementById("visit").value = "Visit 1";
      document.getElementById("validUpto").value = lastCheckupRecord.checkup_duration_validity || calculateExpiryDate(validityDays);
      document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
      hintEl.style.display = "block";
      hintEl.innerHTML = `ℹ️ Resuming Visit 1 (Previously Left Without Treatment).`;
    }
  }
  // Valid Session for Visit 2 (Normal Flow)
  else if (!isExpired && lastCheckupRecord.visit === "Visit 1") {
    document.getElementById("activeCheckupId").value = lastCheckupRecord.checkup_id;
    document.getElementById("displayCheckupId").value = lastCheckupRecord.checkup_id;
    document.getElementById("visit").value = "Visit 2";
    document.getElementById("validUpto").value = expiryDateStr; // Same expiry
    document.getElementById("fee").value = 0; // Visit 2 is free

    hintEl.style.display = "block";
    hintEl.innerHTML = `✅ ID: ${lastCheckupRecord.checkup_id} - Session Valid till ${expiryDateStr}. Proceed to Visit 2.`;
  }
  // Expired or New Cycle (Normal Flow)
  else {
    document.getElementById("activeCheckupId").value = "";
    
    // We only find the max checkup_id among actual checkups to avoid using "-" from payment entries
    const validCheckups = patientHistory.filter(p => p.checkup_id && p.checkup_id !== "-");
    const nextChkId = validCheckups.length > 0 ? (Math.max(...validCheckups.map(p => parseInt(p.checkup_id) || 0)) + 1) : 1;
    
    document.getElementById("displayCheckupId").value = String(nextChkId);
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("validUpto").value = calculateExpiryDate(validityDays);
    document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";

    hintEl.style.display = "block";
    if (isExpired && lastCheckupRecord.visit === "Visit 1") {
      hintEl.innerHTML = `⚠️ Previous checkup expired on ${expiryDateStr}. Starting new checkup cycle.`;
    } else {
      hintEl.innerHTML = `🆕 Previous checkup cycle complete. Starting new checkup cycle.`;
    }
  }

  // Extra visit alert banner logic removed as per new checkbox UI

  // Check 'Under Observation' by default when entry is started
  document.getElementById("underObservation").checked = true;
  handleObservationChange();
  
  // Also check behavior for the auto-populated doctor
  setTimeout(() => { checkPatientBehavior(); }, 100);
}

async function updateBehaviorDropdownColor(isManual = false) {
  const behaviorSelect = document.getElementById("patientBehavior");
  const submitBtn = document.getElementById("submitBtn");
  if (!behaviorSelect) return;
  const val = behaviorSelect.value;

  if (val === "Good" || val === "Bad") {
    if (isManual) {
      const label = val === "Bad" ? "BAD" : "GOOD";
      const reason = await behaviorPromptAsync(`Please enter the reason for marking ${label} behavior:\n(e.g., Rude, Did not follow advice, Very cooperative)`);
      if (reason && reason.trim() !== "") {
        // Store reason in hidden input
        let reasonInput = document.getElementById("behaviorReason");
        if (!reasonInput) {
          reasonInput = document.createElement("input");
          reasonInput.type = "hidden";
          reasonInput.id = "behaviorReason";
          behaviorSelect.parentElement.appendChild(reasonInput);
        }
        reasonInput.value = reason.trim();
      } else {
        // User cancelled or left blank → reset
        behaviorSelect.value = "";
        const reasonInput = document.getElementById("behaviorReason");
        if (reasonInput) reasonInput.value = "";
      }
    }
  } else {
    const reasonInput = document.getElementById("behaviorReason");
    if (reasonInput) reasonInput.value = "";
  }

  const updatedVal = behaviorSelect.value;
  if (updatedVal === "Good") {
    behaviorSelect.style.background = "#22c55e";
    if (submitBtn) submitBtn.style.background = "#22c55e";
  } else if (updatedVal === "Bad") {
    behaviorSelect.style.background = "#ef4444";
    if (submitBtn) submitBtn.style.background = "#ef4444";
  } else {
    behaviorSelect.style.background = "#2563eb";
    if (submitBtn) submitBtn.style.background = "linear-gradient(135deg, #0ea5e9, #0284c7)";
  }
}

function checkPatientBehavior() {
  const doctor = document.getElementById("doctor").value;
  const activePatientId = document.getElementById("activePatientId").value;
  const alertEl = document.getElementById("behaviorAlert");
  const docDropdown = document.getElementById("doctor");
  const submitBtn = document.getElementById("submitBtn");

  if (!alertEl || !docDropdown) return;

  if (!doctor || !activePatientId) {
    alertEl.style.display = "none";
    docDropdown.style.border = "1px solid #5eead4";
    docDropdown.style.background = "#f0fdfa";
    return;
  }

  // Find the MOST RECENT entry for this patient with THIS specific doctor
  const recordsWithDoc = allPatients.filter(p => 
    String(p.patient_id) === String(activePatientId) && 
    String(p.doctor) === String(doctor)
  );

  let hasBadBehavior = false;
  let badReason = "";
  if (recordsWithDoc.length > 0) {
    const latestRecord = recordsWithDoc[0];
    const statusStr = String(latestRecord.status || "");
    // Match both "(Bad)" and "(Bad: reason)" formats
    const behMatch = statusStr.match(/\((Bad(?::\s*([^)]*?))?)\)/);
    if (behMatch) {
      hasBadBehavior = true;
      badReason = behMatch[2] ? behMatch[2].trim() : "";
    }
  }

  if (hasBadBehavior) {
    alertEl.innerHTML = `⚠️ This patient has a <b>BAD BEHAVIOR</b> history with this doctor.${badReason ? ` <br><span style="font-size:9px;">Reason: ${badReason}</span>` : ""} Please consider a different doctor.`;
    alertEl.style.display = "block";
    docDropdown.classList.add("pulse-red-border");
  } else {
    alertEl.style.display = "none";
    docDropdown.classList.remove("pulse-red-border");
    docDropdown.style.border = "1px solid #5eead4";
    docDropdown.style.background = "#f0fdfa";
  }
}

// Another Clinic Logic
function handleAnotherClinicChange() {
  const isAnother = document.getElementById("fromAnotherClinic").checked;
  const isExtra = document.getElementById("isExtraVisit");
  const isLeftWithout = document.getElementById("leftWithoutCheckup")?.checked;

  if (isAnother) {
    // Extra Visit checkbox uncheck karo agar checked ho
    if (isExtra && isExtra.checked) {
      isExtra.checked = false;
      handleExtraVisitCheckbox(); // cleanup extra visit state
    }
  }

  // Agar Left w/o Treatment checked hai to visit type update karo
  if (isLeftWithout) {
    const visitInput = document.getElementById("visit");
    if (isAnother) {
      visitInput.value = "Patient from Another Clinic - Left Without Checkup";
    } else {
      visitInput.value = "Left Clinic Without Treatment";
    }
    visitInput.title = visitInput.value;
    calculateBalance();
    return;
  }

  if (isExtra && isExtra.checked) {
    // If Extra Visit is also checked, let it handle the naming logic
    handleExtraVisitCheckbox();
  } else {
    const visitInput = document.getElementById("visit");
    const feeInput = document.getElementById("fee");
    const defaultFee = localStorage.getItem("defaultFee") || "300";

    if (isAnother) {
      visitInput.value = "Patient from Another Clinic - Visit 2";
      feeInput.value = 0;
    } else {
      if (visitInput.value === "Patient from Another Clinic - Visit 2" || visitInput.value.includes("Patient from Another Clinic - Extra Visit") || visitInput.value.includes("Patient from Another Clinic - Left Without Checkup")) {
        visitInput.value = "Visit 1";
        feeInput.value = defaultFee;
      }
    }
    visitInput.title = visitInput.value;
  }
  calculateBalance();
}

function handleVisitTypeInput() {
  const visitVal = document.getElementById("visit").value.toLowerCase();
  const feeInput = document.getElementById("fee");
  const defaultFee = localStorage.getItem("defaultFee") || "300";

  if (visitVal.includes("visit 1") || visitVal === "visit1") {
    feeInput.value = defaultFee;
  } else if (visitVal.includes("visit 2") || visitVal.includes("extra") || visitVal.includes("another clinic")) {
    feeInput.value = 0;
  }
  
  document.getElementById("visit").title = document.getElementById("visit").value;
  calculateBalance();
}

// Checkbox logic for Extra Visit
function handleExtraVisitCheckbox() {
  const isExtra = document.getElementById("isExtraVisit").checked;
  const paidInput = document.getElementById("paid");
  const feeInput = document.getElementById("fee");
  const visitInput = document.getElementById("visit");
  const hintEl = document.getElementById("smartHint");

  if (isExtra) {
    const patientId = document.getElementById("activePatientId").value;
    if (!patientId) {
      alert("Please select or enter an existing patient first.");
      document.getElementById("isExtraVisit").checked = false;
      return;
    }

    // Uncheck observation if checked
    const obs = document.getElementById("underObservation");
    if (obs.checked) {
      obs.checked = false;
      handleObservationChange();
    }

    // Find latest checkup ID for this patient
    const history = allPatients.filter(p => String(p.patient_id) === String(patientId));
    let checkupId = 1;
    let validUpto = "";
    if (history.length > 0) {
      // Sort history descending by checkup_id
      const sortedHistory = [...history].sort((a, b) => parseInt(b.checkup_id) - parseInt(a.checkup_id));
      checkupId = sortedHistory[0].checkup_id;
      
      const formMode = document.getElementById("formMode").value;
      const origChk = parseInt(document.getElementById("originalCheckupId").value) || 0;
      const origVis = document.getElementById("originalVisit").value;

      // If we are editing the FIRST visit of a newly created checkup cycle, 
      // the refund/extra visit applies to the PREVIOUS checkup cycle.
      if (formMode === "update" && origVis === "Visit 1" && origChk > 1) {
        checkupId = origChk - 1;
      }

      const targetRecord = sortedHistory.find(p => parseInt(p.checkup_id) === parseInt(checkupId));
      if (targetRecord) validUpto = targetRecord.duration || "";
    }

    // Keep form in update mode if we are currently editing
    const mode = document.getElementById("formMode").value;
    const origVis = document.getElementById("originalVisit").value;
    document.getElementById("formMode").value = mode || "add";
    
    document.getElementById("btnText").innerText = (document.getElementById("formMode").value === "update") ? "Update Entry" : "Save Entry";
    
    // Calculate the Extra Visit Name (Extra Visit 1, Extra Visit 2, etc.)
    const isAnother = document.getElementById("fromAnotherClinic")?.checked;
    const baseName = isAnother ? "Patient from Another Clinic - Extra Visit" : "Extra Visit";
    
    let extraVisitName = `${baseName} 1`;
    if (mode === "update" && origVis.toLowerCase().includes("extra visit")) {
      extraVisitName = origVis; // Keep the same name if we are already editing this specific Extra Visit
    } else {
      const extraVisits = history.filter(p => parseInt(p.checkup_id) === parseInt(checkupId) && String(p.visit).toLowerCase().includes("extra visit"));
      if (extraVisits.length > 0) {
        extraVisitName = `${baseName} ${extraVisits.length + 1}`;
      }
    }

    document.getElementById("activeCheckupId").value = checkupId;
    document.getElementById("displayCheckupId").value = checkupId + " ✚";
    visitInput.value = extraVisitName;
    visitInput.title = extraVisitName;
    feeInput.value = 0;
    paidInput.value = "";
    document.getElementById("validUpto").value = validUpto;

    paidInput.disabled = true;

    hintEl.style.display = "block";
    hintEl.innerHTML = `🩺 <strong>${extraVisitName}</strong> on Checkup ID: <strong>${checkupId}</strong> — Fee Refunded (₹0). Status will automatically be calculated.`;
  } else {
    // Unchecked: restore normal state
    paidInput.disabled = false;
    paidInput.value = "";
    hintEl.style.display = "none";
    
    const mode = document.getElementById("formMode").value;
    const patientId = document.getElementById("activePatientId").value;
    const origChk = document.getElementById("originalCheckupId").value;
    const origVis = document.getElementById("originalVisit").value;

    if (mode === "update" && origChk && origVis) {
      // ✅ FIX: Agar original visit khud hi Extra Visit thi,
      // to editPatient() dobara call karne se checkbox wapas check ho jata tha (infinite loop).
      // Is case mein sirf UI restore karo, editPatient() mat bulao.
      const origVisWasExtra = String(origVis).toLowerCase().includes("extra visit");

      if (origVisWasExtra) {
        // Original record extra visit tha — sirf Visit type ko editable chhodo
        // User khud type kar sakta hai jo chahiye
        visitInput.value = origVis; // Show original name
        visitInput.title = origVis;
        document.getElementById("activeCheckupId").value = origChk;
        document.getElementById("displayCheckupId").value = origChk;
        // Fee restore karo (0 se jo bhi default ho)
        document.getElementById("fee").value = 0;
        calculateBalance();
      } else {
        // Original visit normal thi — editPatient se restore karo
        visitInput.value = origVis;
        visitInput.title = origVis;
        document.getElementById("activeCheckupId").value = origChk;
        document.getElementById("displayCheckupId").value = origChk;
        editPatient(patientId, origChk, origVis);
        return; // editPatient calls calculateBalance internally
      }
    } else {
      // Naya entry tha — ID input logic se reset karo
      handleIdInput();
    }
  }
  calculateBalance();
}

function handleIdInput() {
  const inputId = document.getElementById("searchPatientId").value.trim();
  if (inputId === "") {
    document.getElementById("activeCheckupId").value = "";
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("smartHint").style.display = "none";
    document.getElementById("prevBal").value = 0;
    document.getElementById("balanceAlert").style.display = "none";
    const advanceAlert = document.getElementById("advanceAlert");
    if (advanceAlert) advanceAlert.style.display = "none";
    const extraVisitAlertHide = document.getElementById("extraVisitAlert");
    if (extraVisitAlertHide) extraVisitAlertHide.style.display = "none";
    
    document.getElementById("activePatientId").value = "";
    document.getElementById("displayCheckupId").value = "1";
    document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
    document.getElementById("validUpto").value = calculateExpiryDate(parseInt(localStorage.getItem("validityDays") || "15"));
    isPreviewMode = true;
    showPatientBadge("new");
    return;
  }
  const history = allPatients.filter(p => String(p.patient_id) === inputId);
  if (history.length > 0) {
    isPreviewMode = false;
    applyPatientHistory(history[0]);
  } else {
    // ID not found - clear form to prevent showing old patient's data
    clearForm(true); // keepId = true (don't clear the search box itself)
    // Set up new patient state
    isPreviewMode = false;
    document.getElementById("activePatientId").value = inputId;
    document.getElementById("activeCheckupId").value = "";
    document.getElementById("displayCheckupId").value = "1";
    document.getElementById("visit").value = "Visit 1";
    document.getElementById("smartHint").style.display = "none";
    document.getElementById("prevBal").value = 0;
    document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
    document.getElementById("validUpto").value = calculateExpiryDate(parseInt(localStorage.getItem("validityDays") || "15"));
    showPatientBadge("new");
  }
  calculateBalance();
}

let dropdownHideTimeout;

function getDropdownId(field) {
  if (field === 'phone') return "customPhoneDropdown";
  if (field === 'address') return "customAddressDropdown";
  return "customNameDropdown"; // Default to name
}

function showCustomDropdown(field) {
  const dropdown = document.getElementById(getDropdownId(field));
  if (dropdown && dropdown.innerHTML.trim() !== "") {
    dropdown.style.display = "block";
  }
}

function hideCustomDropdown(field) {
  dropdownHideTimeout = setTimeout(() => {
    const dropdown = document.getElementById(getDropdownId(field));
    if (dropdown) dropdown.style.display = "none";
  }, 200);
}

async function handleSearchInput(field) {
  const inputEl = document.getElementById(field);
  if (!inputEl) return;
  const inputVal = inputEl.value.trim().toLowerCase();
  const dropdown = document.getElementById(getDropdownId(field));

  if (inputVal.length === 0) {
    if (field === 'name') {
      const mode = document.getElementById("formMode") ? document.getElementById("formMode").value : "add";
      if (mode !== "update") {
        refreshPreviewIds(); // Name cleared — reset to new patient preview
        showPatientBadge("new");
      }
    }
    if (dropdown) dropdown.style.display = "none";
    return;
  }

  if (inputVal.length < 2) { 
    if (dropdown) dropdown.style.display = "none";
    return; 
  }

  // Special handling for address field: only suggest unique addresses, do not auto-fill entire patient
  if (field === 'address') {
    const uniqueAddresses = new Set();
    allPatients.forEach(p => {
      if (p.address && p.address.toLowerCase().includes(inputVal)) {
        uniqueAddresses.add(p.address.trim());
      }
    });

    if (uniqueAddresses.size > 0) {
      let html = "";
      uniqueAddresses.forEach(addr => {
        html += `
          <div onclick="selectAddressFromDropdown('${addr.replace(/'/g, "\\'")}')" style="padding: 10px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f0fdfa'" onmouseout="this.style.background='white'">
            <span style="font-size: 14px; font-weight: 700; color: #0f172a;">${addr}</span>
          </div>
        `;
      });
      dropdown.innerHTML = html;
      dropdown.style.display = "block";
    } else {
      dropdown.innerHTML = "";
      dropdown.style.display = "none";
    }
    return;
  }

  // Find partial matches for dropdown based on name or phone
  const uniqueMatches = [];
  const seenIds = new Set();
  allPatients.forEach(p => {
    const matchName = p.name && p.name.toLowerCase().includes(inputVal);
    const matchPhone = p.phone && String(p.phone).toLowerCase().includes(inputVal);
    
    if (matchName || matchPhone) {
      if (!seenIds.has(p.patient_id)) {
        seenIds.add(p.patient_id);
        uniqueMatches.push(p);
      }
    }
  });

  if (uniqueMatches.length > 0) {
    // Populate dropdown
    let html = "";
    uniqueMatches.forEach(p => {
      html += `
        <div onclick="selectPatientFromDropdown('${p.patient_id}', '${field}')" style="padding: 10px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#f0fdfa'" onmouseout="this.style.background='white'">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 14px; font-weight: 700; color: #0f172a;">${p.name}</span>
            <span style="font-size: 10px; color: #64748b;">${p.phone || 'No phone'} • ${p.address || 'No address'}</span>
          </div>
          <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">ID: ${p.patient_id}</span>
        </div>
      `;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = "block";
    
    // Always consider it a new patient while typing until they explicitly select one
    if (field === 'name') {
      showPatientBadge("new");
    }
  } else {
    dropdown.innerHTML = "";
    dropdown.style.display = "none";
    if (field === 'name') showPatientBadge("new");
  }
}

function selectAddressFromDropdown(addr) {
  if (dropdownHideTimeout) clearTimeout(dropdownHideTimeout);
  document.getElementById('address').value = addr;
  const dropdown = document.getElementById(getDropdownId('address'));
  if (dropdown) dropdown.style.display = "none";
}

function selectPatientFromDropdown(patientId, field) {
  if (dropdownHideTimeout) clearTimeout(dropdownHideTimeout);
  
  // Find patient history
  const history = allPatients.filter(p => String(p.patient_id) === String(patientId));
  if (history.length > 0) {
    applyPatientHistory(history[0]);
    calculateBalance();
    showPatientBadge("old"); // Explicitly selected an existing patient
  }
  
  // Hide all potential dropdowns just to be safe
  ['name', 'phone', 'address'].forEach(f => {
    const dropdown = document.getElementById(getDropdownId(f));
    if (dropdown) dropdown.style.display = "none";
  });
}

async function fetchPatients() {
  const statusEl = document.getElementById("connectionStatus");
  statusEl.innerHTML = `<span class="dot" style="color: rgba(255,255,255,0.5);">●</span> Syncing...`;
  statusEl.style.color = "rgba(255, 255, 255, 0.8)";
  try {
    const response = await fetch(WEB_APP_URL);
    const data = await response.json();
    allPatients = data.filter(p => (p.patient_id && String(p.patient_id).trim() !== "") || parseFloat(p.payment_by_shehjar) > 0).reverse(); // Keep rows with patient ID or settlement payments
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    updateStats(allPatients);
    statusEl.innerHTML = `<span class="dot">●</span> Connected with Cloud database <i class="fas fa-cloud" style="margin-left:4px; font-size:14px;"></i>`;
    statusEl.style.color = "#ffffff";
    updateDatalist();
    // Refresh preview IDs after fresh sync (only if form is empty)
    if (document.getElementById("name").value.trim() === "") {
      refreshPreviewIds();
    }
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
  const doctor = document.getElementById("doctor").value;
  const isPaymentOnly = document.getElementById("paymentOnly") ? document.getElementById("paymentOnly").checked : false;

  if (!isPaymentOnly && (!doctor || doctor.trim() === "")) {
    alert("Please select the doctor before saving.");
    return;
  }
  
  if (patientId) {
    const hasBadBehavior = allPatients.some(p => 
      String(p.patient_id) === String(patientId) && 
      String(p.doctor) === String(doctor) && 
      p.patient_behavior === "Bad"
    );
    if (hasBadBehavior) {
      const isConfirmed = await customConfirmAsync(`⚠️ This patient had BAD BEHAVIOR with Dr. ${doctor} last time. Assign to another doctor? \n\nClick Cancel to change the doctor, or click OK to Continue anyway.`);
      if (!isConfirmed) {
        return; // User chose to change doctor
      }
    }
  }

  const prevDocBal = parseFloat(document.getElementById("prevBal").value) || 0;
  const prevMedBal = parseFloat(document.getElementById("prevMedBal").value) || 0;
  const totalPrevBal = prevDocBal + prevMedBal;
  
  if (totalPrevBal > 0) {
    const isConfirmed = await customConfirmAsync(`This patient has an old pending balance of ₹${totalPrevBal}. Do you want to save this entry without collecting it now?`);
    if (!isConfirmed) {
      return;
    }
  }

  let finalPatientId = patientId;
  let finalCheckupId = checkupId;

  if (finalPatientId === "") {
    finalPatientId = allPatients.length > 0 ? (Math.max(...allPatients.map(p => parseInt(p.patient_id) || 0)) + 1) : 1;
  }
  if (isPaymentOnly) {
    finalCheckupId = "-";
  } else if (finalCheckupId === "") {
    const patientHistory = allPatients.filter(p => String(p.patient_id) === String(finalPatientId));
    finalCheckupId = patientHistory.length > 0 ? (Math.max(...patientHistory.map(p => parseInt(p.checkup_id) || 0)) + 1) : 1;
  }

  const isObservation = document.getElementById("underObservation").checked;
  const isLeftClinic = document.getElementById("leftClinic") ? document.getElementById("leftClinic").checked : false;
  const isLeftWithoutCheckup = document.getElementById("leftWithoutCheckup") ? document.getElementById("leftWithoutCheckup").checked : false;
  const visitType = document.getElementById("visit").value;
  const formMode = document.getElementById("formMode").value;

  // Prevent duplicate entries for patients currently under observation
  const latestByPatient = {};
  allPatients.forEach(p => {
    if (p.patient_id && !latestByPatient[p.patient_id]) {
      latestByPatient[p.patient_id] = p;
    }
  });
  const latestRecord = latestByPatient[finalPatientId];

  if (!isPaymentOnly && latestRecord && String(latestRecord.status || "").trim().startsWith("Under Observation")) {
    const origChk = document.getElementById("originalCheckupId").value || finalCheckupId;
    const origVis = document.getElementById("originalVisit").value || document.getElementById("visit").value;
    const editingRowIndex = formMode === "update" ? allPatients.find(p => p.patient_id == finalPatientId && p.checkup_id == origChk && p.visit == origVis)?.row_index : null;
    
    if (formMode === "add" || (formMode === "update" && latestRecord.row_index !== editingRowIndex)) {
      alert(`This patient is currently sitting in the Observation List at Token No: ${latestRecord.token_no || '-'}. You cannot add a new session until their active observation is cleared.`);
      return;
    }
  }

  let finalStatus = "";
  if (isPaymentOnly) {
    const pNote = document.getElementById("paymentNote") ? document.getElementById("paymentNote").value.trim() : "";
    if (pNote) {
      finalStatus = "Pharmacy / Payment (" + pNote + ")";
      document.getElementById("visit").value = "Pharmacy / Payment (" + pNote + ")";
    } else {
      finalStatus = "Pharmacy / Payment";
      document.getElementById("visit").value = "Pharmacy / Payment";
    }
  } else if (isObservation) {
    finalStatus = "Under Observation";
  } else if (isLeftClinic) {
    finalStatus = "Left Clinic";
  } else if (isLeftWithoutCheckup) {
    finalStatus = "Left Without Checkup";
  } else {
    finalStatus = "Registered"; // Default status if nothing is explicitly checked
  }

  const currentVisit = document.getElementById("visit").value;
  const origChk = document.getElementById("originalCheckupId").value || finalCheckupId;
  const origVis = document.getElementById("originalVisit").value || currentVisit;

  // Calculate Daily Token Number — per doctor per day
  let finalTokenNo = document.getElementById("tokenNo").value || "";
  if (formMode === "add") {
    if (isPaymentOnly) {
      finalTokenNo = "-";
      document.getElementById("tokenNo").value = finalTokenNo;
    } else {
      const todayStr = formatDate(new Date());
      const selectedDoctor = document.getElementById("doctor").value || "";
      
      // Get all tokens for today for the SAME doctor only
      const doctorTodaysTokens = allPatients
        .filter(p => p.date === todayStr && p.doctor === selectedDoctor && p.token_no && !isNaN(parseInt(p.token_no)))
        .map(p => parseInt(p.token_no));
        
      let nextToken = doctorTodaysTokens.length > 0 ? Math.max(...doctorTodaysTokens) + 1 : 1;
      finalTokenNo = nextToken;
      document.getElementById("tokenNo").value = finalTokenNo;
    }
  }

  // Get exact row_index for foolproof update
  let rowIndexToUpdate = "";
  if (formMode === "update") {
    const idx = allPatients.findIndex(p =>
      String(p.patient_id).trim() === String(finalPatientId).trim() &&
      String(p.checkup_id).trim() === String(origChk).trim() &&
      String(p.visit).trim().toLowerCase() === String(origVis).trim().toLowerCase()
    );
    if (idx !== -1) {
      rowIndexToUpdate = allPatients[idx].row_index;
      // Preserve existing token number if available
      if (!finalTokenNo) finalTokenNo = allPatients[idx].token_no || "";
    }
  }

  const patientBehaviorEl = document.getElementById("patientBehavior");
  const patientBehavior = patientBehaviorEl ? patientBehaviorEl.value : ""; // "Good", "Bad", or "" (unselected)
  const behaviorReasonEl = document.getElementById("behaviorReason");
  const behaviorReason = behaviorReasonEl ? behaviorReasonEl.value.trim() : "";
  
  // Append behavior (with reason) to status if selected
  // e.g. "Left Clinic (Bad: Rude patient)" or "Left Clinic (Good: Very cooperative)"
  if (patientBehavior === "Good" || patientBehavior === "Bad") {
    if (behaviorReason) {
      finalStatus = finalStatus + " (" + patientBehavior + ": " + behaviorReason + ")";
    } else {
      finalStatus = finalStatus + " (" + patientBehavior + ")";
    }
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
    status: finalStatus,  // e.g., "Left Clinic (Bad)" or "Left Clinic"
    duration: isPaymentOnly ? "-" : document.getElementById("validUpto").value,
    action: document.getElementById("formMode").value,
    original_checkup_id: document.getElementById("originalCheckupId").value,
    original_visit: document.getElementById("originalVisit").value,
    token_no: finalTokenNo,
    row_index: rowIndexToUpdate,
    doctor: document.getElementById("doctor").value || "",
    payment_by_shehjar: parseFloat(document.getElementById("paymentByShehjar").value) || 0,
    medicine_fee: parseFloat(document.getElementById("medicineFee").value) || 0,
    medicine_paid: parseFloat(document.getElementById("medicinePaid").value) || 0,
    medicine_balance: parseFloat(document.getElementById("medicineBalance").value) || 0,
    patient_behavior: patientBehavior
  };


  try {
    document.getElementById("btnText").style.display = "none";
    document.getElementById("btnLoader").style.display = "block";
    document.getElementById("submitBtn").disabled = true;

    // Optimistic UI Update
    if (formMode === "update") {
      const idx = allPatients.findIndex(p => p.row_index === rowIndexToUpdate);
      if (idx !== -1) {
        patientData.row_index = rowIndexToUpdate; // Keep it locally
        allPatients[idx] = patientData;
      } else {
        allPatients.unshift(patientData);
      }
    } else {
      allPatients.unshift(patientData);
    }
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    updateStats(allPatients);

    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData)
    });
    
    // Refresh from Google Sheets
    await fetchPatients();
    
    setTimeout(() => {
      clearForm(false);
      document.getElementById("btnText").style.display = "block";
      document.getElementById("btnLoader").style.display = "none";
      const submitBtn = document.getElementById("submitBtn");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.background = "linear-gradient(135deg, #0ea5e9, #0284c7)"; // restore blue
      }
    }, 500);
  } catch (error) {
    console.error("Save failed locally:", error);
    document.getElementById("btnText").style.display = "block";
    document.getElementById("btnLoader").style.display = "none";
    const submitBtnErr = document.getElementById("submitBtn");
    if (submitBtnErr) {
      submitBtnErr.disabled = false;
      submitBtnErr.style.background = "linear-gradient(135deg, #0ea5e9, #0284c7)";
    }
  }
}

async function deletePatient(rowIndex, patientId, checkupId, visit) {
  const isConfirmed = await customConfirmAsync("Are you sure you want to delete this session?");
  if (!isConfirmed) return;

  // Optimistic UI Update
  if (rowIndex) {
    allPatients = allPatients.filter(p => p.row_index !== rowIndex);
  } else {
    allPatients = allPatients.filter(p => !(String(p.patient_id) === String(patientId) && String(p.checkup_id) === String(checkupId) && p.visit === visit));
  }
  
  localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
  renderTable(allPatients);
  if (typeof renderDoctorTally === 'function') renderDoctorTally();
  updateStats(allPatients);

  try {
    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", row_index: rowIndex, patient_id: patientId, checkup_id: checkupId, visit: visit })
    }).then(() => fetchPatients());
  } catch (error) {
    console.error("Delete failed:", error);
  }
}

function renderTable(data, resetPage = true) {
  if (resetPage) currentPage = 1;
  currentDataset = data;
  
  const totalPages = Math.ceil(data.length / rowsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  // Update Pagination UI Elements
  const pageStartEl = document.getElementById("pageStart");
  const pageEndEl = document.getElementById("pageEnd");
  const totalRecordsEl = document.getElementById("totalRecords");
  const pageInfoEl = document.getElementById("pageInfo");
  const btnPrev = document.getElementById("btnPrevPage");
  const btnNext = document.getElementById("btnNextPage");

  if (pageStartEl) pageStartEl.innerText = data.length === 0 ? 0 : startIndex + 1;
  if (pageEndEl) pageEndEl.innerText = Math.min(endIndex, data.length);
  if (totalRecordsEl) totalRecordsEl.innerText = data.length;
  if (pageInfoEl) pageInfoEl.innerText = `Page ${currentPage} of ${totalPages}`;
  
  if (btnPrev) btnPrev.disabled = currentPage === 1;
  if (btnPrev) btnPrev.style.opacity = currentPage === 1 ? "0.5" : "1";
  if (btnNext) btnNext.disabled = currentPage === totalPages || totalPages === 0;
  if (btnNext) btnNext.style.opacity = (currentPage === totalPages || totalPages === 0) ? "0.5" : "1";

  const tableBody = document.getElementById("patientTableBody");
  tableBody.innerHTML = "";
  if (paginatedData.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center; padding:30px; color:#7f8c8d;'>No sessions found.</td></tr>";
    return;
  }
  paginatedData.forEach((p, index) => {
    const bal = parseFloat(p.balance) || 0;
    const isPending = bal > 0;
    const isAdvance = bal < 0;

    // Parse behavior from status field: "Left Clinic (Bad)" → cleanStatus="Left Clinic", behavior="Bad"
    const rawStatus = String(p.status || "");
    const behaviorMatch = rawStatus.match(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/);
    const behavior = behaviorMatch ? behaviorMatch[2] : null; // "Good", "Bad", or null
    const cleanStatus = behaviorMatch ? rawStatus.replace(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/, "").trim() : rawStatus;

    let badgeClass;
    if (cleanStatus.includes("Pharmacy / Payment")) badgeClass = 'status-payment';
    else if (cleanStatus === "Left Clinic") badgeClass = 'status-left-clinic';
    else if (cleanStatus === "Refunded-->Extra-visit") badgeClass = 'status-refunded';
    else if (cleanStatus === "Under Observation") badgeClass = 'status-observation';
    else if (isPending) badgeClass = 'status-pending';
    else if (isAdvance) badgeClass = 'status-advance';
    else badgeClass = 'status-done';
    const balColor = isPending ? '#e74c3c' : (isAdvance ? '#2b6cb0' : '#27ae60');

    const row = document.createElement("tr");
    row.className = "optimistic-row";
    
    const isSettlement = parseFloat(p.payment_by_shehjar) > 0 && !p.patient_id;
    if (isSettlement) {
      row.classList.add("settlement-row");
    } else if (behavior === "Bad") {
      row.style.background = "#fecaca"; // light red for bad behavior
      row.style.color = "#7f1d1d"; // dark red text
    } else if (cleanStatus === "Left Clinic") {
      row.style.background = "#bbf7d0"; // green for left clinic
    }

    setTimeout(() => { row.classList.remove("optimistic-row"); }, 500);

    row.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" value="${p.row_index}" onclick="event.stopPropagation()" onchange="updateDeleteCount()" style="cursor: pointer; accent-color: #ef4444; width: 16px; height: 16px;"></td>
      <td>${isSettlement ? '-' : (p.patient_id || '-')}</td>
      <td>${isSettlement ? '-' : (p.checkup_id || '-')}</td>
      <td>${isSettlement ? '-' : `<span style="background:#ffedd5;color:#9a3412;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:12px;">${p.token_no || '-'}</span>`}</td>
      <td>${p.date || '-'}</td>
      <td style="font-weight: 600;">${isSettlement ? '<span style="color:#8b5cf6;"><i>Doctor Payment Entry</i></span>' : (p.name || '-')}</td>
      <td>${isSettlement ? '-' : (p.phone || '-')}</td>
      <td>${isSettlement ? '-' : (p.address || '-')}</td>
      <td><span style="background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;">${p.doctor || '-'}</span></td>
      <td>${isSettlement ? '-' : (p.visit || '-')}</td>
      <td>${isSettlement ? '-' : '₹ ' + (p.fee || 0)}</td>
      <td>${isSettlement ? '-' : '₹ ' + (p.paid || 0)}</td>
      <td style="font-weight: 700; color: ${balColor}">${isSettlement ? '-' : '₹ ' + (p.balance || 0)}</td>
      <td style="color: #8b5cf6; font-weight: 600;">₹ ${parseFloat(p.payment_by_shehjar || 0)}</td>
      <td style="color: #059669;">${isSettlement ? '-' : '₹ ' + parseFloat(p.medicine_fee || 0)}</td>
      <td style="color: #10b981;">${isSettlement ? '-' : '₹ ' + parseFloat(p.medicine_paid || 0)}</td>
      <td style="font-weight: 700; color: ${parseFloat(p.medicine_balance || 0) > 0 ? '#dc2626' : '#27ae60'}">${isSettlement ? '-' : (parseFloat(p.medicine_balance || 0) > 0 ? '₹ ' + p.medicine_balance : '₹ 0')}</td>
      <td>${isSettlement ? '-' : (p.checkup_duration_validity || p.duration || '-')}</td>
      <td>${isSettlement ? '-' : (() => {
        let reasonMatch = rawStatus.match(/\((Good|Bad):\s*([^)]+)\)$/);
        let behaviorText = behavior === 'Good' ? '(Good Behavior)' : '(Bad Behavior)';
        if (reasonMatch) behaviorText = `(${behaviorMatch[1]} Behavior: ${reasonMatch[2]})`;
        
        if (behavior === 'Good') return `<span class="status-badge ${badgeClass}" style="white-space:nowrap;">${cleanStatus}</span><span style="display:inline-block; margin-top:3px; font-size:9px; font-weight:800; color:#16a34a; background:#dcfce7; padding:1px 6px; border-radius:3px;">${behaviorText}</span>`;
        if (behavior === 'Bad')  return `<span class="status-badge ${badgeClass}" style="white-space:nowrap;">${cleanStatus}</span><span style="display:inline-block; margin-top:3px; font-size:9px; font-weight:800; color:#dc2626; background:#fee2e2; padding:1px 6px; border-radius:3px;">${behaviorText}</span>`;
        return `<span class="status-badge ${badgeClass}">${cleanStatus}</span>`;
      })()}</td>
      <td>
        <div style="display: flex; gap: 5px;">
          <button class="btn" style="background: #e0f2fe; color: #0284c7; padding: 5px 10px;" onclick="event.stopPropagation(); ${isSettlement ? 'alert(\'Settlement entries cannot be edited.\')' : `editPatient(${p.patient_id}, ${p.checkup_id}, '${p.visit}')`}" title="Edit / Pay">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn" style="background: #fff5f5; color: #c53030; padding: 5px 10px;" onclick="event.stopPropagation(); deletePatient(${p.row_index || 'null'}, '${p.patient_id || ''}', '${p.checkup_id || ''}', '${p.visit || ''}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable(currentDataset, false);
  }
}

function nextPage() {
  const totalPages = Math.ceil(currentDataset.length / rowsPerPage) || 1;
  if (currentPage < totalPages) {
    currentPage++;
    renderTable(currentDataset, false);
  }
}

function clearForm(keepId = false) {
  const searchInput = document.getElementById("searchPatientId");
  const currentSearchValue = searchInput.value;

  document.getElementById("patientForm").reset();

  if (keepId) {
    searchInput.value = currentSearchValue;
  } else {
    searchInput.value = "";
  }
  document.getElementById("formMode").value = "add";
  document.getElementById("btnText").innerText = "Save Entry";
  document.getElementById("displayCheckupId").value = "";
  document.getElementById("tokenNo").value = "";
  document.getElementById("activePatientId").value = "";
  document.getElementById("activeCheckupId").value = "";
  document.getElementById("balanceAlert").style.display = "none";
  const advanceAlert = document.getElementById("advanceAlert");
  if (advanceAlert) advanceAlert.style.display = "none";
  const medBalanceAlert = document.getElementById("medBalanceAlert");
  if (medBalanceAlert) medBalanceAlert.style.display = "none";
  const extraVisitAlertClear = document.getElementById("extraVisitAlert");
  if (extraVisitAlertClear) extraVisitAlertClear.style.display = "none";
  document.getElementById("smartHint").style.display = "none";

  // Reset Default Values
  
  const paymentOnly = document.getElementById("paymentOnly");
  if (paymentOnly) paymentOnly.checked = false;
  const doctorSelectClear = document.getElementById("doctor");
  if (doctorSelectClear) doctorSelectClear.disabled = false;

  document.getElementById("underObservation").checked = true;
  handleObservationChange();
  document.getElementById("visit").value = "Visit 1";
  document.getElementById("prevBal").value = 0;
  document.getElementById("fee").value = localStorage.getItem("defaultFee") || "300";
  document.getElementById("validUpto").value = calculateExpiryDate(localStorage.getItem("validityDays") || "15");

  // Clear medicine & shehjar fields
  document.getElementById("prevMedBal").value = "";
  document.getElementById("paymentByShehjar").value = "";
  document.getElementById("medicineFee").value = "";
  document.getElementById("medicinePaid").value = "";
  document.getElementById("medicineBalance").value = "";

  // Reset doctor dropdown (no pre-selection)
  populateDoctorsDropdown("");

  // Re-enable paid field if it was disabled by extra visit mode
  const paidInputClear = document.getElementById("paid");
  if (paidInputClear) paidInputClear.disabled = false;


  const leftClinic = document.getElementById("leftClinic");
  if (leftClinic) {
    leftClinic.checked = false;
  }

  const anotherClinic = document.getElementById("fromAnotherClinic");
  if (anotherClinic) {
    anotherClinic.checked = false;
  }
  
  // Reset behavior dropdown to UNSELECTED (blank) and button to default blue
  const behaviorSel = document.getElementById("patientBehavior");
  if (behaviorSel) {
    behaviorSel.value = "";          // reset to placeholder
    behaviorSel.style.background = "#2563eb"; // blue
  }
  const submitBtnClear = document.getElementById("submitBtn");
  if (submitBtnClear) submitBtnClear.style.background = "linear-gradient(135deg, #0ea5e9, #0284c7)"; // restore blue gradient

  // Hide behavior alert and remove pulse class
  const alertEl = document.getElementById("behaviorAlert");
  const docDropdown = document.getElementById("doctor");
  if (alertEl) alertEl.style.display = "none";
  if (docDropdown) {
    docDropdown.classList.remove("pulse-red-border");
    docDropdown.style.border = "1px solid #5eead4";
    docDropdown.style.background = "#f0fdfa";
  }

  // Show preview IDs for next new patient entry
  if (!keepId) {
    refreshPreviewIds();
  } else {
    // Only refresh Token No since we are keeping the manually typed Patient ID
    const todayStr = formatDate(new Date());
    const todaysTokens = allPatients
      .filter(p => p.date === todayStr && p.token_no && !isNaN(parseInt(p.token_no)))
      .map(p => parseInt(p.token_no));
    document.getElementById("tokenNo").value = todaysTokens.length > 0 ? Math.max(...todaysTokens) + 1 : 1;
  }
}

function updateDatalist() {
  // Update doctor filter dropdown
  const filterDoctorSel = document.getElementById("filterDoctor");
  if (filterDoctorSel) {
    const currentVal = filterDoctorSel.value;
    const doctors = [...new Set(allPatients.map(p => p.doctor).filter(d => d && d.trim() !== ""))];
    filterDoctorSel.innerHTML = `<option value="">All Doctors</option>`;
    doctors.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === currentVal) opt.selected = true;
      filterDoctorSel.appendChild(opt);
    });
  }

  // Also update Doctor Tally dropdown
  const dtFilterDoctorSel = document.getElementById("dtFilterDoctor");
  if (dtFilterDoctorSel) {
    const dtCurrentVal = dtFilterDoctorSel.value;
    const doctors = [...new Set(allPatients.map(p => p.doctor).filter(d => d && d.trim() !== ""))];
    dtFilterDoctorSel.innerHTML = `<option value="">All Doctors</option>`;
    doctors.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === dtCurrentVal) opt.selected = true;
      dtFilterDoctorSel.appendChild(opt);
    });
  }

  // Populate Patient Tally Datalist
  const ptSuggestions = document.getElementById("ptPatientSuggestions");
  if (ptSuggestions) {
    const patientsMap = new Map();
    allPatients.forEach(p => {
      if (p.patient_id && p.name) {
        patientsMap.set(p.patient_id, `${p.name} (#${p.patient_id})`);
      }
    });
    ptSuggestions.innerHTML = "";
    patientsMap.forEach((nameId, id) => {
      ptSuggestions.innerHTML += `<option value="${nameId}">`;
    });
  }

  const ptFilterDoctorSel = document.getElementById("ptFilterDoctor");
  if (ptFilterDoctorSel) {
    const ptCurDoctor = ptFilterDoctorSel.value;
    const doctors = [...new Set(allPatients.map(p => p.doctor).filter(d => d && d.trim() !== ""))];
    ptFilterDoctorSel.innerHTML = `<option value="">All Doctors</option>`;
    doctors.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === ptCurDoctor) opt.selected = true;
      ptFilterDoctorSel.appendChild(opt);
    });
  }
}

// Auto-fill next available Patient ID and Checkup ID for new patient preview
function refreshPreviewIds() {
  // Always update Daily Token Number preview first
  // Find smallest available token for today
  const todayStr = formatDate(new Date());
  const todaysTokens = allPatients
    .filter(p => p.date === todayStr && p.token_no && !isNaN(parseInt(p.token_no)))
    .map(p => parseInt(p.token_no));
    
  let nextToken = todaysTokens.length > 0 ? Math.max(...todaysTokens) + 1 : 1;
  document.getElementById("tokenNo").value = nextToken;

  if (allPatients.length === 0) {
    document.getElementById("searchPatientId").value = "1";
    document.getElementById("activePatientId").value = "1";
    document.getElementById("displayCheckupId").value = "1";
    isPreviewMode = true;
    showPatientBadge("new");
    return;
  }
  
  const nextPatientId = Math.max(...allPatients.map(p => parseInt(p.patient_id) || 0)) + 1;
  document.getElementById("searchPatientId").value = nextPatientId;
  document.getElementById("activePatientId").value = nextPatientId;
  document.getElementById("displayCheckupId").value = "1";
  isPreviewMode = true;
  showPatientBadge("new");
}

// Show badge above name field: New Patient (green) or Existing Patient (blue)
function showPatientBadge(type) {
  const badge = document.getElementById("patientTypeBadge");
  if (!badge) return;
  if (type === "new") {
    badge.textContent = "🆕 New Patient";
    badge.className = "patient-badge badge-new";
  } else {
    badge.textContent = "✅ Existing Patient";
    badge.className = "patient-badge badge-old";
  }
  badge.style.display = "inline-flex";
}

function applyFilters() {
  const fId = document.getElementById("filterPatId").value.trim().toLowerCase();
  const fChkId = document.getElementById("filterChkId").value.trim().toLowerCase();
  const fDate = document.getElementById("filterDate").value;
  const fName = document.getElementById("filterName").value.trim().toLowerCase();
  const fPhone = document.getElementById("filterPhone").value.trim().toLowerCase();
  const fDoctor = document.getElementById("filterDoctor").value.trim().toLowerCase();

  const filtered = allPatients.filter(p => {
    const matchId = fId === "" || String(p.patient_id).toLowerCase() === fId;
    const matchChkId = fChkId === "" || String(p.checkup_id).toLowerCase() === fChkId;
    const matchDate = fDate === "" || String(p.date) === fDate;
    const matchName = fName === "" || String(p.name).toLowerCase().includes(fName);
    const matchPhone = fPhone === "" || String(p.phone).toLowerCase().includes(fPhone);
    const matchDoctor = fDoctor === "" || String(p.doctor || "").toLowerCase() === fDoctor;
    return matchId && matchChkId && matchDate && matchName && matchPhone && matchDoctor;
  });
  renderTable(filtered);
}

function resetFilters() {
  document.getElementById("filterPatId").value = "";
  document.getElementById("filterChkId").value = "";
  document.getElementById("filterDate").value = "";
  document.getElementById("filterName").value = "";
  document.getElementById("filterPhone").value = "";
  document.getElementById("filterDoctor").value = "";
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

// Handle observation checkbox change
function handleObservationChange() {
  const isObs = document.getElementById("underObservation").checked;
  const isLeft = document.getElementById("leftClinic");
  const paidInput = document.getElementById("paid");
  const medPaidInput = document.getElementById("medicinePaid");
  
  if (isObs && isLeft && isLeft.checked) {
    isLeft.checked = false; // Mutually exclusive
  } else if (!isObs && isLeft && !isLeft.checked) {
    // Auto check leftClinic if underObservation is unchecked
    isLeft.checked = true;
  }

  const tooltip = "This patient is under observation. Please uncheck the under observation then you can enter the amount.";

  if (isObs) {
    paidInput.value = "";
    paidInput.disabled = true;
    paidInput.title = tooltip;
    
    if (medPaidInput) {
      medPaidInput.value = "";
      medPaidInput.disabled = true;
      medPaidInput.title = tooltip;
    }
  } else {
    paidInput.value = ""; // Clear to blank so user enters fresh amount
    paidInput.disabled = false;
    paidInput.title = "";

    if (medPaidInput) {
      medPaidInput.value = "";
      medPaidInput.disabled = false;
      medPaidInput.title = "";
    }
  }
  calculateBalance();
  calculateMedicineBalance();
}

// Handle Payment Only checkbox change
function handlePaymentOnlyChange() {
  const isPaymentOnly = document.getElementById("paymentOnly").checked;
  const visitInput = document.getElementById("visit");
  const feeInput = document.getElementById("fee");
  const doctorSelect = document.getElementById("doctor");
  const paymentNote = document.getElementById("paymentNote");
  
  if (isPaymentOnly) {
    if (paymentNote) paymentNote.style.display = "inline-block";
    
    // Uncheck conflicting checkboxes
    const obsCheckbox = document.getElementById("underObservation");
    if (obsCheckbox && obsCheckbox.checked) { obsCheckbox.checked = false; handleObservationChange(); }
    
    const leftClinicCheckbox = document.getElementById("leftClinic");
    if (leftClinicCheckbox) leftClinicCheckbox.checked = false;
    
    const leftWithout = document.getElementById("leftWithoutCheckup");
    if (leftWithout && leftWithout.checked) { leftWithout.checked = false; handleLeftWithoutCheckupChange(); }
    
    const extraVisitCheckbox = document.getElementById("isExtraVisit");
    if (extraVisitCheckbox && extraVisitCheckbox.checked) { extraVisitCheckbox.checked = false; handleExtraVisitCheckbox(); }

    const anotherClinicCheckbox = document.getElementById("fromAnotherClinic");
    if (anotherClinicCheckbox) anotherClinicCheckbox.checked = false;

    // Store original values
    if (!visitInput.dataset.originalVisit) visitInput.dataset.originalVisit = visitInput.value;
    if (!feeInput.dataset.originalFee) feeInput.dataset.originalFee = feeInput.value;
    if (!doctorSelect.dataset.originalDoctor) doctorSelect.dataset.originalDoctor = doctorSelect.value;
    
    const tokenNoInput = document.getElementById("tokenNo");
    if (tokenNoInput) {
      if (!tokenNoInput.dataset.originalToken) tokenNoInput.dataset.originalToken = tokenNoInput.value;
      tokenNoInput.value = "-";
      tokenNoInput.disabled = true;
    }

    const checkupIdInput = document.getElementById("displayCheckupId");
    if (checkupIdInput) {
      if (!checkupIdInput.dataset.originalCheckup) checkupIdInput.dataset.originalCheckup = checkupIdInput.value;
      checkupIdInput.value = "-";
      checkupIdInput.disabled = true;
    }

    const validUptoInput = document.getElementById("validUpto");
    if (validUptoInput) {
      if (!validUptoInput.dataset.originalDate) validUptoInput.dataset.originalDate = validUptoInput.value;
      validUptoInput.value = "";
      validUptoInput.disabled = true;
    }

    visitInput.value = "Pharmacy / Payment";
    feeInput.value = "0";
    
    // Disable doctor select
    doctorSelect.value = "";
    doctorSelect.disabled = true;
    
    calculateBalance();
  } else {
    if (paymentNote) {
      paymentNote.style.display = "none";
      paymentNote.value = "";
    }
    
    // Restore visit type
    if (visitInput.dataset.originalVisit) {
      visitInput.value = visitInput.dataset.originalVisit;
      delete visitInput.dataset.originalVisit;
    } else {
      visitInput.value = "Visit 1";
    }
    
    // Restore fee
    if (feeInput.dataset.originalFee) {
      feeInput.value = feeInput.dataset.originalFee;
      delete feeInput.dataset.originalFee;
    } else {
      handleVisitTypeInput();
    }
    
    // Restore doctor
    if (doctorSelect.dataset.originalDoctor) {
      doctorSelect.value = doctorSelect.dataset.originalDoctor;
      delete doctorSelect.dataset.originalDoctor;
    }
    doctorSelect.disabled = false;

    // Restore token, checkup id, and valid date
    const tokenNoInput = document.getElementById("tokenNo");
    if (tokenNoInput) {
      if (tokenNoInput.dataset.originalToken) {
        tokenNoInput.value = tokenNoInput.dataset.originalToken;
        delete tokenNoInput.dataset.originalToken;
      }
      tokenNoInput.disabled = false;
    }

    const checkupIdInput = document.getElementById("displayCheckupId");
    if (checkupIdInput) {
      if (checkupIdInput.dataset.originalCheckup) {
        checkupIdInput.value = checkupIdInput.dataset.originalCheckup;
        delete checkupIdInput.dataset.originalCheckup;
      }
      checkupIdInput.disabled = false;
    }

    const validUptoInput = document.getElementById("validUpto");
    if (validUptoInput) {
      if (validUptoInput.dataset.originalDate) {
        validUptoInput.value = validUptoInput.dataset.originalDate;
        delete validUptoInput.dataset.originalDate;
      }
      validUptoInput.disabled = false;
    }
    
    calculateBalance();
  }
}

// Handle Left Clinic checkbox change
function handleLeftClinicChange() {
  const isLeft = document.getElementById("leftClinic").checked;
  const isObs = document.getElementById("underObservation");
  const leftWithout = document.getElementById("leftWithoutCheckup");
  
  if (isLeft) {
    if (isObs && isObs.checked) {
      isObs.checked = false;
      handleObservationChange(); // Trigger logic to enable payment fields
    }
    if (leftWithout && leftWithout.checked) {
      leftWithout.checked = false;
      handleLeftWithoutCheckupChange(); // Re-enable fields that were disabled
    }
  }
}

function handleLeftWithoutCheckupChange() {
  const isLeftWithout = document.getElementById("leftWithoutCheckup").checked;
  const visitInput = document.getElementById("visit");
  const feeInput = document.getElementById("fee");
  const paidInput = document.getElementById("paid");
  
  if (isLeftWithout) {
    // Uncheck conflicting checkboxes
    const obsCheckbox = document.getElementById("underObservation");
    if (obsCheckbox && obsCheckbox.checked) {
      obsCheckbox.checked = false;
      handleObservationChange();
    }
    const leftClinicCheckbox = document.getElementById("leftClinic");
    if (leftClinicCheckbox) leftClinicCheckbox.checked = false;

    // Extra Visit checkbox bhi uncheck karo
    const extraVisitCheckbox = document.getElementById("isExtraVisit");
    if (extraVisitCheckbox && extraVisitCheckbox.checked) {
      extraVisitCheckbox.checked = false;
      handleExtraVisitCheckbox(); // cleanup paid field etc.
    }

    // Store original visit type
    if (visitInput.value !== "Left Clinic Without Treatment" && !visitInput.value.includes("Left Without Checkup")) {
      visitInput.dataset.originalVisit = visitInput.value;
    }

    // Agar Another Clinic bhi checked hai, to combined visit type set karo
    const isAnotherClinic = document.getElementById("fromAnotherClinic")?.checked;
    if (isAnotherClinic) {
      visitInput.value = "Patient from Another Clinic - Left Without Checkup";
    } else {
      visitInput.value = "Left Clinic Without Treatment";
    }

    // Store original fee and paid
    if (!feeInput.dataset.originalFee) feeInput.dataset.originalFee = feeInput.value;
    if (!paidInput.dataset.originalPaid) paidInput.dataset.originalPaid = paidInput.value;

    // Set Fees to 0
    feeInput.value = "0";
    paidInput.value = "0";
    paidInput.disabled = true;

    calculateBalance();
  } else {
    // Restore visit type if it was saved
    if (visitInput.dataset.originalVisit) {
      visitInput.value = visitInput.dataset.originalVisit;
      delete visitInput.dataset.originalVisit; // clear it
    } else {
      visitInput.value = "Visit 1"; // Fallback
    }
    
    // Restore fee
    if (feeInput.dataset.originalFee) {
      feeInput.value = feeInput.dataset.originalFee;
      delete feeInput.dataset.originalFee;
    } else {
      handleVisitTypeInput(); // Fallback recalculation
    }
    
    // Restore paid
    if (paidInput.dataset.originalPaid) {
      paidInput.value = paidInput.dataset.originalPaid;
      delete paidInput.dataset.originalPaid;
    } else {
      paidInput.value = "";
    }
    
    // Re-enable the paid field.
    paidInput.disabled = false;
    calculateBalance();
  }
}

function uncheckObservation() {
  const obsCheckbox = document.getElementById("underObservation");
  if (obsCheckbox.checked) {
    obsCheckbox.checked = false;
    
    const leftClinic = document.getElementById("leftClinic");
    if (leftClinic && !leftClinic.checked) {
      leftClinic.checked = true;
    }

    // Just enable the inputs without clearing the value since they are typing
    const paidInput = document.getElementById("paid");
    const medPaidInput = document.getElementById("medicinePaid");
    
    paidInput.disabled = false;
    paidInput.title = "";
    
    if (medPaidInput) {
      medPaidInput.disabled = false;
      medPaidInput.title = "";
    }
  }
}

// Edit a patient's entry for payment update
function editPatient(patientId, checkupId, visit) {
  let history;
  if (visit) {
    history = allPatients.filter(p => String(p.patient_id) === String(patientId) && String(p.checkup_id) === String(checkupId) && p.visit === visit);
  } else {
    history = allPatients.filter(p => String(p.patient_id) === String(patientId) && String(p.checkup_id) === String(checkupId));
  }
  if (history.length === 0) return;
  const p = history[0];

  isPreviewMode = false;
  showPatientBadge("old");

  document.getElementById("originalCheckupId").value = p.checkup_id;
  document.getElementById("originalVisit").value = p.visit;

  document.getElementById("formMode").value = "update";
  document.getElementById("btnText").innerText = "Update Entry";

  document.getElementById("activePatientId").value = p.patient_id;
  document.getElementById("activeCheckupId").value = p.checkup_id;
  document.getElementById("displayCheckupId").value = p.checkup_id;
  document.getElementById("searchPatientId").value = p.patient_id;
  document.getElementById("tokenNo").value = p.token_no || "";

  document.getElementById("name").value = p.name;
  document.getElementById("phone").value = p.phone;
  document.getElementById("address").value = p.address || "";
  document.getElementById("visit").value = p.visit;
  document.getElementById("fee").value = p.fee;
  document.getElementById("paid").value = p.paid || ""; // Set paid amount

  // Calculate previous balance (excluding this specific record)
  const prevRecords = allPatients.filter(r => String(r.patient_id) === String(patientId) && r.row_index !== p.row_index);
  const prevBal = prevRecords.reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0);
  document.getElementById("prevBal").value = prevBal;

  const balanceAlert = document.getElementById("balanceAlert");
  const pendingValue = document.getElementById("pendingValue");
  const advanceAlert = document.getElementById("advanceAlert");
  const advanceValue = document.getElementById("advanceValue");

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

  // Populate doctor dropdown with this patient's doctor
  populateDoctorsDropdown(p.doctor || "");

  // Compute previous medicine balance from all OTHER records of this patient
  const otherMedRecords = allPatients.filter(r => String(r.patient_id) === String(patientId) && r.row_index !== p.row_index);
  const otherMedFee = otherMedRecords.reduce((s, r) => s + (parseFloat(r.medicine_fee) || 0), 0);
  const otherMedPaid = otherMedRecords.reduce((s, r) => s + (parseFloat(r.medicine_paid) || 0), 0);
  const prevMedBalance = otherMedFee - otherMedPaid;

  // Set prevMedBal field (from other records)
  document.getElementById("prevMedBal").value = prevMedBalance > 0 ? prevMedBalance : 0;

  // Show medBalAlert if previous medicine balance is pending
  const medBalAlertEdit = document.getElementById("medBalanceAlert");
  const medPendingValueEdit = document.getElementById("medPendingValue");
  if (prevMedBalance > 0 && medBalAlertEdit) {
    medBalAlertEdit.style.display = "block";
    medPendingValueEdit.innerText = prevMedBalance;
  } else if (medBalAlertEdit) {
    medBalAlertEdit.style.display = "none";
  }

  // Populate today's medicine fields from this record
  document.getElementById("medicineFee").value = p.medicine_fee || "";
  document.getElementById("medicinePaid").value = p.medicine_paid || "";
  document.getElementById("medicineBalance").value = p.medicine_balance || "";

  document.getElementById("paymentByShehjar").value = p.payment_by_shehjar || "";

  if (p.visit.toLowerCase().includes("extra visit")) {
    document.getElementById("isExtraVisit").checked = true;
    document.getElementById("displayCheckupId").value = p.checkup_id + " ✚";
    // Disable paid field for extra visits (fee refunded)
    document.getElementById("paid").disabled = true;
    document.getElementById("paid").value = "";
  } else {
    document.getElementById("isExtraVisit").checked = false;
    document.getElementById("paid").disabled = false; // Make sure paid is enabled
  }
  
  const pStatusClean = String(p.status || "").replace(/\s*\(((Good|Bad)(?::\s*([^)]*?))?)\)$/, "").trim();
  if (pStatusClean === "Under Observation") {
    document.getElementById("underObservation").checked = true;
    document.getElementById("leftClinic").checked = false;
    if (document.getElementById("leftWithoutCheckup")) document.getElementById("leftWithoutCheckup").checked = false;
  } else if (pStatusClean === "Left Clinic") {
    document.getElementById("underObservation").checked = false;
    document.getElementById("leftClinic").checked = true;
    if (document.getElementById("leftWithoutCheckup")) document.getElementById("leftWithoutCheckup").checked = false;
  } else if (pStatusClean === "Left Without Checkup") {
    document.getElementById("underObservation").checked = false;
    document.getElementById("leftClinic").checked = false;
    if (document.getElementById("leftWithoutCheckup")) document.getElementById("leftWithoutCheckup").checked = true;
  } else {
    document.getElementById("underObservation").checked = false;
    document.getElementById("leftClinic").checked = false;
    if (document.getElementById("leftWithoutCheckup")) document.getElementById("leftWithoutCheckup").checked = false;
  }
  
  if (document.getElementById("patientBehavior")) {
    // Extract behavior from status string e.g. "Left Clinic (Bad: Rude)" → "Bad"
    const statusStr = String(p.status || "");
    const behMatch = statusStr.match(/\(((Good|Bad)(?::\s*([^)]*?))?)\)$/);
    const extractedBehavior = behMatch ? behMatch[2] : "";
    const extractedReason = behMatch ? behMatch[3] || "" : "";
    
    document.getElementById("patientBehavior").value = extractedBehavior;
    updateBehaviorDropdownColor(); // Make sure color updates
    
    // Also set the reason if we are editing
    if (extractedReason) {
      let reasonInput = document.getElementById("behaviorReason");
      if (!reasonInput) {
        reasonInput = document.createElement("input");
        reasonInput.type = "hidden";
        reasonInput.id = "behaviorReason";
        document.getElementById("patientBehavior").parentElement.appendChild(reasonInput);
      }
      reasonInput.value = extractedReason.trim();
    }
    document.getElementById("patientBehavior").value = extractedBehavior;
    if (typeof updateBehaviorDropdownColor === "function") {
      updateBehaviorDropdownColor();
    }
  }
  handleObservationChange();
  calculateBalance();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Tab Switching Logic
async function switchTab(tabId, btnElement) {
  if (tabId === 'recentSessionsTab') {
    const key = await customPromptAsync("Please enter the access key:");
    if (key === null) return; // Cancelled
    if (key.toLowerCase() !== "muzamil") {
      window.alert("Invalid access key!");
      return;
    }
  }

  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show target tab
  document.getElementById(tabId).classList.add('active');
  
  // Update button active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  btnElement.classList.add('active');

  // If opening Doctor Tally tab, render it
  if (tabId === 'doctorTallyTab') {
    renderDoctorTally();
  }
  
  // If opening Patient Tally tab, render it
  if (tabId === 'patientsTallyTab') {
    renderPatientTally();
    renderBalanceSheet();
  }
  
}

window.switchPatientTallyTab = function(tab) {
  if (tab === 'statement') {
    document.getElementById('ptStatementContainer').style.display = 'block';
    document.getElementById('ptBalanceSheetContainer').style.display = 'none';
    document.getElementById('ptTabStatement').style.background = '#c026d3';
    document.getElementById('ptTabStatement').style.color = 'white';
    document.getElementById('ptTabBalanceSheet').style.background = '#e2e8f0';
    document.getElementById('ptTabBalanceSheet').style.color = '#475569';
  } else {
    document.getElementById('ptStatementContainer').style.display = 'none';
    document.getElementById('ptBalanceSheetContainer').style.display = 'block';
    document.getElementById('ptTabStatement').style.background = '#e2e8f0';
    document.getElementById('ptTabStatement').style.color = '#475569';
    document.getElementById('ptTabBalanceSheet').style.background = '#0ea5e9';
    document.getElementById('ptTabBalanceSheet').style.color = 'white';
    renderBalanceSheet();
  }
}

let currentDoctorTallyTab = 'history';

window.switchDoctorTallyTab = function(tab) {
  currentDoctorTallyTab = tab;
  if (tab === 'statement') {
    document.getElementById('dtStatementContainer').style.display = 'block';
    document.getElementById('dtHistoryContainer').style.display = 'none';
    document.getElementById('dtTabStatement').style.background = '#0ea5e9';
    document.getElementById('dtTabStatement').style.color = 'white';
    document.getElementById('dtTabHistory').style.background = '#e2e8f0';
    document.getElementById('dtTabHistory').style.color = '#475569';
  } else {
    document.getElementById('dtStatementContainer').style.display = 'none';
    document.getElementById('dtHistoryContainer').style.display = 'block';
    document.getElementById('dtTabStatement').style.background = '#e2e8f0';
    document.getElementById('dtTabStatement').style.color = '#475569';
    document.getElementById('dtTabHistory').style.background = '#0ea5e9';
    document.getElementById('dtTabHistory').style.color = 'white';
  }
}

// Reset Doctor Tally Filters
function resetDoctorTallyFilters() {
  document.getElementById("dtFilterDoctor").value = "";
  document.getElementById("dtFilterFromDate").value = "";
  document.getElementById("dtFilterToDate").value = "";
  document.getElementById("dtFilterPatId").value = "";
  document.getElementById("dtFilterVisit").value = "";
  renderDoctorTally();
}

// Doctor Tally Logic
function renderDoctorTally() {
  const fDoc = document.getElementById("dtFilterDoctor").value.trim().toLowerCase();
  const fFrom = document.getElementById("dtFilterFromDate").value;
  const fTo = document.getElementById("dtFilterToDate").value;
  const fPatId = document.getElementById("dtFilterPatId").value.trim();
  const fVisit = document.getElementById("dtFilterVisit").value.trim().toLowerCase();

  // Filter Data
  const filtered = allPatients.filter(p => {
    // Exclude patient tally payments from doctor tally
    if (String(p.visit || "").toLowerCase() === "payment" && p.payment_by_shehjar === 0) return false;

    // Exclude Pharmacy / Payment entries from doctor tally
    if (String(p.visit || "").includes("Pharmacy / Payment") || String(p.status || "").includes("Pharmacy / Payment")) return false;

    const matchDoc = fDoc === "" || String(p.doctor || "").toLowerCase().trim() === fDoc;
    const matchFrom = fFrom === "" || p.date >= fFrom;
    const matchTo = fTo === "" || p.date <= fTo;
    const matchPatId = fPatId === "" || String(p.patient_id) === fPatId;
    const matchVisit = fVisit === "" || String(p.visit || "").toLowerCase().trim().includes(fVisit);
    return matchDoc && matchFrom && matchTo && matchPatId && matchVisit;
  });

  // Render Table & Calculate Totals
  const tbody = document.getElementById("dtTableBody");
  tbody.innerHTML = "";
  
  let totalFee = 0;
  let totalPaid = 0;
  let totalShehjar = 0;

  filtered.forEach(p => {
    const fee = parseFloat(p.fee) || 0;
    const paid = parseFloat(p.paid) || 0;
    const shehjar = parseFloat(p.payment_by_shehjar) || 0;
    
    totalFee += fee;
    totalPaid += paid;
    totalShehjar += shehjar;

    const isSettlement = shehjar > 0 && !p.patient_id;
    const row = document.createElement("tr");
    if (shehjar > 0) {
      row.classList.add("payment-row"); // Settlement / Doctor Payment Entry
    }
    row.innerHTML = `
      <td>${p.date || '-'}</td>
      <td style="color: #3b82f6; font-weight: 500;">${p.doctor || '-'}</td>
      <td style="font-weight: 600;">${isSettlement ? `<span style="color:#8b5cf6;"><i>${p.name || 'Doctor Payment Entry'}</i></span>` : (p.name || '-')} ${isSettlement ? '' : `<span style="font-size: 11px; color: #64748b;">(#${p.patient_id || '-'})</span>`}</td>
      <td>${isSettlement ? '-' : `<span style="font-size: 12px; font-weight: bold; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">ID:${p.checkup_id || '-'}</span> <br><span style="font-size: 11px; color: #64748b;">${p.visit || '-'}</span>`}</td>
      <td style="color: #0284c7; font-weight: 500;">${isSettlement ? '-' : '₹ ' + fee}</td>
      <td style="color: #16a34a; font-weight: 500;">${isSettlement ? '-' : '₹ ' + paid}</td>
      <td style="color: #8b5cf6; font-weight: 500;">₹ ${shehjar}</td>
    `;
    tbody.appendChild(row);
  });

  // Update Footer Totals
  document.getElementById("dtTotalFee").innerText = `₹ ${totalFee}`;
  document.getElementById("dtTotalPaid").innerText = `₹ ${totalPaid}`;
  document.getElementById("dtTotalShehjar").innerText = `₹ ${totalShehjar}`;

  // Update Receipt View
  const todayDateStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format
  document.getElementById("rcptDate").innerText = todayDateStr;
  
  const labelEl = document.getElementById("rcptPaidByShehjarLabel");
  if (labelEl) {
    labelEl.innerText = `Paid by Shehjar on ${todayDateStr}`;
  }
  
  // We keep the input value so it can be printed on the receipt
  // document.getElementById("rcptPaidByShehjar").value = "";

  if (fDoc !== "") {
    // A specific doctor is selected
    const sel = document.getElementById("dtFilterDoctor");
    document.getElementById("rcptDoctorName").innerText = sel.options[sel.selectedIndex].text;
    
    // Format receipt fields
    document.getElementById("rcptAmountDoctor").innerText = `₹ ${totalFee}`;
    
    const todayStrYYYY = formatDate(new Date());
    document.getElementById("rcptFromDate").innerText = fFrom ? fFrom : "Start";
    document.getElementById("rcptToDate").innerText = fTo ? fTo : todayStrYYYY;
    
    // Calculate Last Balance
    let lastBalance = 0;
    let lastBalanceDateText = "Date: --/--/----";

    if (fFrom !== "") {
      const historyBeforeFrom = allPatients.filter(p => {
        const pDoc = String(p.doctor || "").toLowerCase().trim();
        return pDoc === fDoc && p.date && p.date < fFrom;
      });

      let prevFee = 0;
      let prevPaidByShehjar = 0;
      historyBeforeFrom.forEach(p => {
        prevFee += parseFloat(p.fee) || 0;
        prevPaidByShehjar += parseFloat(p.payment_by_shehjar) || 0;
      });

      lastBalance = prevFee - prevPaidByShehjar;
      lastBalanceDateText = `Before: ${fFrom}`;
    }

    document.getElementById("rcptLastBalance").innerText = `₹ ${lastBalance}`;
    document.getElementById("rcptLastBalance").dataset.val = lastBalance;
    document.getElementById("rcptLastBalanceDate").innerText = lastBalanceDateText;


    // Calculate sum of payments made TODAY
    let sumPaidToday = 0;
    allPatients.forEach(p => {
      const pDoc = String(p.doctor || "").toLowerCase().trim();
      if (pDoc === fDoc && p.date === todayStrYYYY) {
        sumPaidToday += parseFloat(p.payment_by_shehjar) || 0;
      }
    });

    document.getElementById("rcptPaidByShehjar").value = sumPaidToday > 0 ? sumPaidToday : "";
    document.getElementById("rcptPaidByShehjar").dataset.savedSum = sumPaidToday;

    // Already Received should EXCLUDE today's payments
    let alreadyRec = 0;
    filtered.forEach(p => {
      if (p.date !== todayStrYYYY) {
        alreadyRec += parseFloat(p.payment_by_shehjar) || 0;
      }
    });

    document.getElementById("rcptAlreadyReceived").innerText = `₹ ${alreadyRec}`;
    document.getElementById("rcptAlreadyReceived").dataset.val = alreadyRec;

  } else {
    document.getElementById("rcptDoctorName").innerText = "-- Select Doctor --";
    document.getElementById("rcptAmountDoctor").innerText = `₹ 0`;
    document.getElementById("rcptFromDate").innerText = "--";
    document.getElementById("rcptToDate").innerText = "--";
    
    document.getElementById("rcptLastBalance").innerText = `₹ 0`;
    document.getElementById("rcptLastBalance").dataset.val = 0;
    document.getElementById("rcptLastBalanceDate").innerText = "Date: --/--/----";

    document.getElementById("rcptAlreadyReceived").innerText = `₹ 0`;
    document.getElementById("rcptAlreadyReceived").dataset.val = 0;
  }
  
  updateReceiptCalculation();
  renderDoctorHistory(filtered);
}

function renderDoctorHistory(filteredData) {
  const tbody = document.getElementById("dtHistoryTableBody");
  tbody.innerHTML = "";
  
  const fDoc = document.getElementById("dtFilterDoctor").value.trim();
  
  if (fDoc === "") {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 30px; font-weight: 700; font-size: 16px;">Please select the doctor first.</td></tr>`;
    document.getElementById("dtHistoryTotalAmount").innerText = `₹ 0`;
    document.getElementById("dtHistoryTotalShehjar").innerText = `₹ 0`;
    document.getElementById("dtHistoryRemaining").innerText = `₹ 0`;
    return;
  }
  
  if (!filteredData || filteredData.length === 0) {
    document.getElementById("dtHistoryTotalAmount").innerText = `₹ 0`;
    document.getElementById("dtHistoryTotalShehjar").innerText = `₹ 0`;
    document.getElementById("dtHistoryRemaining").innerText = `₹ 0`;
    return;
  }

  // Aggregate by Date
  const historyMap = {};

  filteredData.forEach(p => {
    const date = p.date;
    if (!date) return;
    
    if (!historyMap[date]) {
      historyMap[date] = { date: date, visit1Count: 0, totalAmount: 0, shehjarPaid: 0 };
    }
    
    const visitStr = String(p.visit || "").toLowerCase().trim();
    const shehjar = parseFloat(p.payment_by_shehjar) || 0;
    const isSettlement = shehjar > 0 && !p.patient_id;
    
    if (isSettlement) {
      historyMap[date].shehjarPaid += shehjar;
    } else {
      // Check if it's a first visit (Visit 1 and not Extra)
      const hasVisit1 = visitStr.includes("visit 1") || visitStr.includes("visit1");
      const isExtra = visitStr.includes("extra");
      
      if (hasVisit1 && !isExtra) {
        historyMap[date].visit1Count += 1;
        historyMap[date].totalAmount += parseFloat(p.fee) || 0;
      }
    }
  });

  // Sort dates descending
  const sortedDates = Object.keys(historyMap).sort((a, b) => new Date(b) - new Date(a));
  
  let grandTotalAmount = 0;
  let grandTotalShehjar = 0;

  sortedDates.forEach(d => {
    const data = historyMap[d];
    grandTotalAmount += data.totalAmount;
    grandTotalShehjar += data.shehjarPaid;
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.date}</td>
      <td style="color: #0284c7; font-weight: 500;">
        ${data.visit1Count} <span style="color: #94a3b8; font-size: 11px;">visits</span> = <strong>₹ ${data.totalAmount}</strong>
      </td>
      <td style="color: #8b5cf6; font-weight: 500;">₹ ${data.shehjarPaid}</td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById("dtHistoryTotalAmount").innerText = `₹ ${grandTotalAmount}`;
  document.getElementById("dtHistoryTotalShehjar").innerText = `₹ ${grandTotalShehjar}`;
  document.getElementById("dtHistoryRemaining").innerText = `₹ ${grandTotalAmount - grandTotalShehjar}`;
}


window.updateReceiptCalculation = function() {
  let lastBal = parseFloat(document.getElementById("rcptLastBalance").dataset.val);
  if (isNaN(lastBal)) {
    lastBal = parseFloat(document.getElementById("rcptLastBalance").innerText.replace(/[^0-9.-]+/g,"")) || 0;
  }
  
  const currentAmtStr = document.getElementById("rcptAmountDoctor").innerText.replace(/[^0-9.-]+/g,"");
  const currentAmt = parseFloat(currentAmtStr) || 0;

  let alreadyRec = parseFloat(document.getElementById("rcptAlreadyReceived").dataset.val);
  if (isNaN(alreadyRec)) {
    alreadyRec = parseFloat(document.getElementById("rcptAlreadyReceived").innerText.replace(/[^0-9.-]+/g,"")) || 0;
  }
  
  const total = lastBal + currentAmt - alreadyRec;
  document.getElementById("rcptTotal").innerText = `₹ ${total}`;
  
  const paid = parseFloat(document.getElementById("rcptPaidByShehjar").value) || 0;
  const remaining = total - paid;
  
  document.getElementById("rcptRemaining").innerText = `₹ ${remaining}`;
};

window.saveDoctorSettlement = async function() {
  const docName = document.getElementById("rcptDoctorName").innerText;
  if (docName === "-- Select Doctor --" || docName === "") {
    alert("Please select a valid doctor to save settlement.");
    return;
  }
  
  const paidAmt = parseFloat(document.getElementById("rcptPaidByShehjar").value) || 0;
  const savedSum = parseFloat(document.getElementById("rcptPaidByShehjar").dataset.savedSum) || 0;
  
  if (paidAmt <= 0) {
    alert("You haven't entered any amount to save a new entry.");
    return;
  }

  if (paidAmt === savedSum && savedSum > 0) {
    alert("This amount is already the total saved for today! To add a NEW payment, please erase it and enter the new payment amount.");
    return;
  }
  
  const btn = document.getElementById("btnSaveSettlement");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  btn.disabled = true;

  const today = new Date();
  const systemDate = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, '0') + "-" + String(today.getDate()).padStart(2, '0');

  const notesEl = document.getElementById("rcptNotes");
  const notes = notesEl && notesEl.value.trim() !== "" ? notesEl.value.trim() : "";
  const displayName = notes ? `Doctor Payment Entry (${notes})` : "Doctor Payment Entry";

  const payload = {
    action: "insert",
    date: systemDate,
    doctor: docName,
    payment_by_shehjar: paidAmt,
    name: displayName
  };

  try {
    await fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    // Assume success due to no-cors
    alert("Settlement saved successfully!");
    document.getElementById("rcptPaidByShehjar").value = "";
    const notesEl = document.getElementById("rcptNotes");
    if (notesEl) notesEl.value = "";
    updateReceiptCalculation();
    
    // Optimistic UI update
    allPatients.unshift({
      date: systemDate,
      doctor: docName,
      payment_by_shehjar: paidAmt,
      name: displayName
    });
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    renderDoctorTally();
    
    // Refresh fully in background
    fetchPatients(); 
  } catch (e) {
    console.error(e);
    alert("Network error.");
  } finally {
    btn.innerText = "Save Entry";
    btn.disabled = false;
  }
};

// ==========================================
// Print Functionality
// ==========================================

window.printStatement = function() {
  const printArea = document.getElementById('printArea');
  if (!printArea) return;
  
  const doctor = document.getElementById("dtFilterDoctor");
  const docName = doctor.options[doctor.selectedIndex].text;
  const from = document.getElementById("dtFilterFromDate").value || "All Time";
  const to = document.getElementById("dtFilterToDate").value || "All Time";

  // Get table HTML by cloning based on active tab
  let tableContainer;
  if (currentDoctorTallyTab === 'history') {
    tableContainer = document.getElementById("dtHistoryTableBody").closest('table');
  } else {
    tableContainer = document.getElementById("dtTableBody").closest('table');
  }
  
  const cloneTable = tableContainer.cloneNode(true);
  
  // To prevent the total footer from repeating on every printed page,
  // we move the tfoot row into the tbody as the final row.
  const tfoot = cloneTable.querySelector('tfoot');
  const tbody = cloneTable.querySelector('tbody');
  if (tfoot && tbody) {
    const footerRows = Array.from(tfoot.children);
    footerRows.forEach(row => tbody.appendChild(row));
    tfoot.remove();
  }
  
  const tableHtml = cloneTable.outerHTML;

  const headerHtml = `
    <div style="background: linear-gradient(135deg, #110e62, #00d3a5); padding: 20px; text-align: center; color: white; display: flex; align-items: center; justify-content: center; gap: 15px; border-radius: 8px 8px 0 0; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
         <img src="logo.jpeg" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
      </div>
      <div style="text-align: left;">
        <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Shehjaar Medicate</h1>
        <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">${currentDoctorTallyTab === 'history' ? "Doctor Payment History" : "Doctor Activity & Payment Statement"}</p>
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 14px; color: #475569; font-weight: bold; background: #f8fafc; padding: 12px 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; font-family: sans-serif; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <span>Doctor: ${docName}</span>
      <span>Date Range: ${from} To ${to}</span>
    </div>
  `;

  printArea.innerHTML = headerHtml + tableHtml;

  document.body.classList.add('printing-custom', 'print-mode-statement');
  
  // Wait slightly to let the image decode and render in the DOM before printing
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-custom', 'print-mode-statement');
    printArea.innerHTML = "";
  }, 300);
};

window.printReceipt = function() {
  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const receiptCard = document.getElementById("receiptCard");
  if (!receiptCard) return;
  
  // Replace input with a div showing the same value for better printing
  const clone = receiptCard.cloneNode(true);
  
  const rcptNotesDiv = clone.querySelector('#rcptNotes');
  if (rcptNotesDiv && rcptNotesDiv.parentElement) rcptNotesDiv.parentElement.parentElement.remove();
  
  const input = clone.querySelector('#rcptPaidByShehjar');
  if (input) {
    const parent = input.parentElement;
    const val = input.value;
    input.outerHTML = `<div style="width: 100%; padding: 4px 6px 4px 18px; border: 2px solid #ddd6fe; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: 600; color: #8b5cf6; background: #f5f3ff; box-sizing: border-box;">${val}</div>`;
  }

  printArea.innerHTML = `<div class="receipt-wrapper">${clone.innerHTML}</div>`;

  document.body.classList.add('printing-custom', 'print-mode-receipt');
  
  // Wait slightly to let the image decode and render in the DOM before printing
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-custom', 'print-mode-receipt');
    printArea.innerHTML = "";
  }, 300);
};

/* ==========================================================================
   Patient Tally Logic (Placeholders)
   ========================================================================== */

window.renderPatientTally = function() {
  const tableBody = document.getElementById("ptTableBody");
  const pFilterRaw = document.getElementById("ptFilterPatient").value.trim();
  const dFilterName = document.getElementById("ptFilterDoctor").value;
  const fDate = document.getElementById("ptFilterFromDate").value;
  const tDate = document.getElementById("ptFilterToDate").value;

  // Extract ID if it was selected from datalist (e.g. "Rehan (#1)")
  let pFilterId = "";
  if (pFilterRaw) {
    const match = pFilterRaw.match(/\(#(\d+)\)/);
    if (match) {
      pFilterId = match[1];
    }
  }

  // Filter data
  let filtered = allPatients.filter(p => {
    // Exclude rows where patient name/id is missing (Settlements)
    if (!p.patient_id || p.patient_id.toString().trim() === "" || !p.name || p.name.trim() === "") return false;

    let match = true;
    if (pFilterRaw) {
      if (pFilterId) {
        if (p.patient_id.toString() !== pFilterId) match = false;
      } else {
        // Fallback: search by name or direct ID typed
        if (!p.name.toLowerCase().includes(pFilterRaw.toLowerCase()) && p.patient_id.toString() !== pFilterRaw) {
          match = false;
        }
      }
    }
    
    if (dFilterName && p.doctor !== dFilterName) match = false;
    if (fDate && p.date < fDate) match = false;
    if (tDate && p.date > tDate) match = false;
    return match;
  });

  tableBody.innerHTML = "";
  
  let totalDr = 0, totalPaidDr = 0, totalMed = 0, totalPaidMed = 0;

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">No records found.</td></tr>`;
  } else {
    filtered.forEach(p => {
      const drFee = parseFloat(p.fee) || 0;
      const paidDrFee = parseFloat(p.paid) || 0;
      const medFee = parseFloat(p.medicine_fee) || 0;
      const paidMedFee = parseFloat(p.medicine_paid) || 0;

      totalDr += drFee;
      totalPaidDr += paidDrFee;
      totalMed += medFee;
      totalPaidMed += paidMedFee;

      const isPayment = String(p.visit || "").toLowerCase() === "payment";
      const tr = document.createElement("tr");
      if (isPayment) {
        tr.classList.add("payment-row");
      }
      tr.innerHTML = `
        <td>${p.date}</td>
        <td><strong>${p.name}</strong> <span style="color:#64748b; font-size:11px;">(#${p.patient_id})</span></td>
        <td>
          ${p.visit} <span style="color:#64748b; font-size:11px;">(Chk: ${p.checkup_id})</span>
          ${p.notes ? `<br><span style="color:#059669; font-size:10.5px; font-style:italic;"><i class="fas fa-sticky-note"></i> ${p.notes}</span>` : ''}
        </td>
        <td>${p.doctor || '-'}</td>
        <td style="color:#0284c7;">₹ ${drFee}</td>
        <td style="color:#16a34a;">₹ ${paidDrFee}</td>
        <td style="color:#ea580c;">₹ ${medFee}</td>
        <td style="color:#16a34a;">₹ ${paidMedFee}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  document.getElementById("ptTotalDrFee").innerText = `₹ ${totalDr}`;
  document.getElementById("ptTotalPaidDrFee").innerText = `₹ ${totalPaidDr}`;
  document.getElementById("ptTotalMedFee").innerText = `₹ ${totalMed}`;
  document.getElementById("ptTotalPaidMedFee").innerText = `₹ ${totalPaidMed}`;

  // Update Invoice logic
  // Determine if a specific patient was targeted via the search filter
  let selectedPatient = null;
  if (pFilterRaw) {
    if (pFilterId) {
       selectedPatient = allPatients.find(p => p.patient_id && p.patient_id.toString() === pFilterId);
    } else {
       selectedPatient = allPatients.find(p => p.name && p.name.toLowerCase().includes(pFilterRaw.toLowerCase()));
    }
  }

  if (selectedPatient) {
    // Explicitly selected patient (even if current table date range is empty)
    updatePatientInvoiceUI(selectedPatient, filtered);
  } else if (filtered.length > 0) {
    // No explicit search text, but let's see if the table only has one patient's records
    const uniquePatients = [...new Set(filtered.map(p => p.patient_id.toString()))];
    if (uniquePatients.length === 1) {
      const pInfo = allPatients.find(p => p.patient_id.toString() === uniquePatients[0]);
      updatePatientInvoiceUI(pInfo, filtered);
    } else {
      updatePatientInvoiceUI(null, []);
    }
  } else {
    // Empty table and no patient searched
    updatePatientInvoiceUI(null, []);
  }
};

function formatAdvance(amount) {
  if (amount < 0) return `<span style="color: #10b981;">₹ ${Math.abs(amount)} (Adv)</span>`;
  return `₹ ${amount}`;
}

function updatePatientInvoiceUI(patient, patientRecords) {
  if (!patient) {
    document.getElementById("invPatientName").innerText = "-- Select Patient --";
    document.getElementById("invDate").innerText = "--/--/----";
    document.getElementById("invLastBalance").innerHTML = "₹ 0";
    document.getElementById("invLastBalanceDate").innerText = "(--/--/----)";
    document.getElementById("invDrFee").innerText = "₹ 0";
    document.getElementById("invPaidDrFee").innerText = "₹ 0";
    document.getElementById("invRemDrFee").innerHTML = "₹ 0";
    document.getElementById("invMedFee").innerText = "₹ 0";
    document.getElementById("invPaidMedFee").innerText = "₹ 0";
    document.getElementById("invRemMedFee").innerHTML = "₹ 0";
    document.getElementById("invTotalPayable").innerHTML = "₹ 0";
    document.getElementById("invFinalBalance").innerHTML = "₹ 0";
    
    document.getElementById("invPaidByLabel").innerHTML = `PAID BY <span style="color:#2563eb;">--</span><br>ON <span style="color:#2563eb;">--/--/----</span>`;
    document.getElementById("invPaidToday").value = "";
    document.getElementById("ptInvoiceNotes").value = "";
    document.getElementById("invPaidToday").disabled = true;
    document.getElementById("btnSavePatientPayment").disabled = true;
    return;
  }

  const fDate = document.getElementById("ptFilterFromDate").value;
  const allPatientRecords = allPatients.filter(p => p.patient_id && p.patient_id.toString() === patient.patient_id.toString());
  
  const todayStrYYYY = formatDate(new Date());
  
  let lastBalance = 0;
  if (fDate) {
    // Calculate sum of everything strictly before fDate
    let priorDrFee = 0, priorPaidDr = 0, priorMedFee = 0, priorPaidMed = 0;
    allPatientRecords.forEach(p => {
      if (p.date < fDate) {
        priorDrFee += parseFloat(p.fee) || 0;
        priorMedFee += parseFloat(p.medicine_fee) || 0;
        if (p.date !== todayStrYYYY) {
          priorPaidDr += parseFloat(p.paid) || 0;
          priorPaidMed += parseFloat(p.medicine_paid) || 0;
        }
      }
    });
    lastBalance = (priorDrFee + priorMedFee) - (priorPaidDr + priorPaidMed);
  }

  // Calculate selected range totals
  let totalDr = 0, totalPaidDr = 0, totalMed = 0, totalPaidMed = 0;
  patientRecords.forEach(p => {
    totalDr += parseFloat(p.fee) || 0;
    totalMed += parseFloat(p.medicine_fee) || 0;
    if (p.date !== todayStrYYYY) {
      totalPaidDr += parseFloat(p.paid) || 0;
      totalPaidMed += parseFloat(p.medicine_paid) || 0;
    }
  });

  const remDrFee = totalDr - totalPaidDr;
  const remMedFee = totalMed - totalPaidMed;
  
  document.getElementById("invLastBalance").innerHTML = formatAdvance(lastBalance);
  document.getElementById("invLastBalanceDate").innerText = fDate ? `(< ${fDate})` : `(All Time)`;
  
  document.getElementById("invDrFee").innerText = `₹ ${totalDr}`;
  document.getElementById("invPaidDrFee").innerText = `₹ ${totalPaidDr}`;
  document.getElementById("invRemDrFee").innerHTML = formatAdvance(remDrFee);

  document.getElementById("invMedFee").innerText = `₹ ${totalMed}`;
  document.getElementById("invPaidMedFee").innerText = `₹ ${totalPaidMed}`;
  document.getElementById("invRemMedFee").innerHTML = formatAdvance(remMedFee);

  const totalPayable = lastBalance + remDrFee + remMedFee;

  document.getElementById("invTotalPayable").innerHTML = formatAdvance(totalPayable);
  document.getElementById("invTotalPayable").dataset.payable = totalPayable;
  
  const todayStr = formatDate(new Date());
  document.getElementById("invPatientName").innerText = `${patient.name} (${patient.patient_id})`;
  document.getElementById("invDate").innerText = todayStr;
  document.getElementById("invPaidByLabel").innerHTML = `PAID BY <span style="color:#2563eb;">${patient.name.toUpperCase()}</span><br>ON <span style="color:#2563eb;">${todayStr}</span>`;
  
  // Calculate total paid TODAY for this patient
  let sumPaidToday = 0;
  allPatientRecords.forEach(p => {
    if (p.date === todayStr) {
      sumPaidToday += (parseFloat(p.paid) || 0) + (parseFloat(p.medicine_paid) || 0);
    }
  });

  document.getElementById("invPaidToday").disabled = false;
  document.getElementById("invPaidToday").value = sumPaidToday > 0 ? sumPaidToday : "";
  document.getElementById("ptInvoiceNotes").value = "";
  document.getElementById("invPaidToday").dataset.savedSum = sumPaidToday;
  
  document.getElementById("btnSavePatientPayment").disabled = false;
  
  window.updatePatientFinalBalance();
}

window.updatePatientFinalBalance = function() {
  const payableSpan = document.getElementById("invTotalPayable");
  const payable = parseFloat(payableSpan.dataset.payable) || 0;
  const paidToday = parseFloat(document.getElementById("invPaidToday").value) || 0;
  
  const finalBalance = payable - paidToday;
  document.getElementById("invFinalBalance").innerHTML = formatAdvance(finalBalance);
};

window.resetPatientTallyFilters = function() {
  document.getElementById('ptFilterPatient').value = '';
  document.getElementById('ptFilterDoctor').value = '';
  document.getElementById('ptFilterFromDate').value = '';
  document.getElementById('ptFilterToDate').value = '';
  renderPatientTally();
};

window.printPatientStatement = function() {
  const pFilterRaw = document.getElementById("ptFilterPatient").value.trim();
  let pFilterId = pFilterRaw;
  if (pFilterRaw) {
    const match = pFilterRaw.match(/\(#(\d+)\)/);
    if (match) pFilterId = match[1];
  }

  const dFilterName = document.getElementById("ptFilterDoctor").value;
  const fDate = document.getElementById("ptFilterFromDate").value;
  const tDate = document.getElementById("ptFilterToDate").value;
  
  let pName = "All Patients";
  if (pFilterId) {
    // Try exact ID match first
    let pInfo = allPatients.find(p => p.patient_id.toString() === pFilterId);
    // Fallback to name search if ID not found
    if (!pInfo) pInfo = allPatients.find(p => p.name.toLowerCase().includes(pFilterId.toLowerCase()));
    if (pInfo) pName = `${pInfo.name} (#${pInfo.patient_id})`;
  }

  let dName = dFilterName || "All Doctors";
  const fromStr = fDate || "Start";
  const toStr = tDate || "End";

  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const tableClone = document.querySelector("#patientsTallyTab .table-container").cloneNode(true);
  
  const headerHtml = `
    <div style="background: linear-gradient(135deg, #0f766e, #059669); padding: 20px; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 20px; margin-bottom: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
        <img src="logo.jpeg" alt="Logo" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
      </div>
      <div style="text-align: left;">
        <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Shehjaar Medicate</h1>
        <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Patient Statement</p>
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 14px; color: #475569; font-weight: bold; background: #f8fafc; padding: 12px 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; font-family: sans-serif; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <span>Patient: ${pName}</span>
      <span>Doctor: ${dName}</span>
      <span>Date Range: ${fromStr} To ${toStr}</span>
    </div>
  `;

  printArea.innerHTML = headerHtml + `<div class="table-container">${tableClone.innerHTML}</div>`;

  document.body.classList.add('printing-custom', 'print-mode-statement');
  
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-custom', 'print-mode-statement');
    printArea.innerHTML = "";
  }, 300);
};

window.savePatientPayment = async function() {
  const pFilterRaw = document.getElementById("ptFilterPatient").value.trim();
  let pFilterId = pFilterRaw;
  if (pFilterRaw) {
    const match = pFilterRaw.match(/\(#(\d+)\)/);
    if (match) pFilterId = match[1];
  }

  if (!pFilterId) return alert("Please select a patient to save payment.");
  
  const paidInput = document.getElementById("invPaidToday");
  const paidAmount = parseFloat(paidInput.value) || 0;
  const savedSum = parseFloat(paidInput.dataset.savedSum) || 0;
  
  if (paidAmount <= 0) return alert("Please enter a valid amount greater than 0.");
  if (paidAmount === savedSum && savedSum > 0) {
    alert("This amount is already the total saved for today! To add a NEW payment, please erase it and enter the new payment amount.");
    return;
  }
  
  let patient = allPatients.find(p => p.patient_id && p.patient_id.toString() === pFilterId);
  // Fallback to name match
  if (!patient) patient = allPatients.find(p => p.name.toLowerCase().includes(pFilterId.toLowerCase()));
  if (!patient) return alert("Patient not found.");

  const btn = document.getElementById("btnSavePatientPayment");
  btn.disabled = true;
  btn.innerText = "Saving...";
  
  const notesStr = document.getElementById("ptInvoiceNotes").value.trim() || "";

  const patientData = {
    patient_id: patient.patient_id,
    checkup_id: "",
    date: formatDate(new Date()),
    name: patient.name,
    phone: patient.phone || "",
    address: patient.address || "",
    visit: "Payment",
    fee: 0,
    paid: 0,
    balance: 0,
    status: "Pending",
    notes: notesStr,
    duration: "",
    action: "add",
    original_checkup_id: "",
    original_visit: "",
    token_no: "",
    doctor: "", // Intentionally empty so no doctor appears for payment
    payment_by_shehjar: 0,
    medicine_fee: 0,
    medicine_paid: paidAmount,
    medicine_balance: -paidAmount,
    is_just_saved_receipt: true
  };

  try {
    // Optimistic UI Update
    allPatients.unshift(patientData);
    localStorage.setItem("cachedPatients", JSON.stringify(allPatients));
    renderTable(allPatients);
    updateStats(allPatients);
    renderPatientTally(); // This will auto-refresh the invoice correctly

    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData)
    });

    setTimeout(() => {
      alert("Payment saved successfully!");
      btn.innerText = "Save Entry";
      btn.disabled = false;
    }, 500);

  } catch (error) {
    console.error("Save failed:", error);
    btn.innerText = "Save Entry";
    btn.disabled = false;
    alert("Failed to save payment.");
  }
};

window.printPatientInvoice = function() {
  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const invoiceCard = document.getElementById("patientInvoiceCard");
  if (!invoiceCard) return;
  
  const clone = invoiceCard.cloneNode(true);
  
  const ptInvoiceNotesDiv = clone.querySelector('#ptInvoiceNotes');
  if (ptInvoiceNotesDiv && ptInvoiceNotesDiv.parentElement) ptInvoiceNotesDiv.parentElement.remove();
  
  // Replace inputs with divs
  const inputs = clone.querySelectorAll('input');
  inputs.forEach(input => {
    const val = input.value;
    input.outerHTML = `<div style="font-family: monospace; font-size: 14px; font-weight: 700; color: #0f766e;">${val}</div>`;
  });
  
  // Remove the Save button from print
  const btn = clone.querySelector('#btnSavePatientPayment');
  if (btn) btn.remove();

  printArea.innerHTML = `<div class="receipt-wrapper" style="width: 350px; margin: 0 auto;">${clone.innerHTML}</div>`;

  document.body.classList.add('printing-custom', 'print-mode-receipt');
  
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-custom', 'print-mode-receipt');
    printArea.innerHTML = "";
  }, 300);
};

// --- BULK DELETE LOGIC ---
function updateDeleteCount() {
  const count = document.querySelectorAll(".row-checkbox:checked").length;
  const btn = document.getElementById("btnBulkDelete");
  if (btn) {
    btn.innerHTML = `<i class="fas fa-trash"></i> Delete ${count > 0 ? count + ' ' : ''}Selected`;
  }
}

function toggleSelectAllRows() {
  const isChecked = document.getElementById("selectAllRows").checked;
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(cb => cb.checked = isChecked);
  updateDeleteCount();
}

async function deleteSelectedRows() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Please select at least one row to delete.");
    return;
  }
  
  const isConfirmed = await customConfirmAsync(`Are you sure you want to delete ${checkboxes.length} selected record(s)?`);
  if (!isConfirmed) return;

  const loader = document.getElementById("splashLoader");
  if (loader) loader.style.display = "flex";

  const requests = Array.from(checkboxes).map(cb => {
    return fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", row_index: cb.value })
    });
  });

  Promise.all(requests).then(() => {
    document.getElementById("selectAllRows").checked = false;
    fetchPatients(); // This automatically hides the loader
  }).catch(err => {
    console.error("Bulk Delete Error:", err);
    alert("Some records could not be deleted. Please check your connection.");
    fetchPatients();
  });
}

window.renderBalanceSheet = function() {
  const tbody = document.getElementById("ptBalanceSheetTableBody");
  const emptyMsg = document.getElementById("ptBalanceSheetEmpty");
  
  if (!tbody || !emptyMsg) return;

  const patientMap = new Map();

  allPatients.forEach(p => {
    if (!p.patient_id) return;
    const id = String(p.patient_id);
    
    const fee = parseFloat(p.fee) || 0;
    const paid = parseFloat(p.paid) || 0;
    const medFee = parseFloat(p.medicine_fee) || 0;
    const medPaid = parseFloat(p.medicine_paid) || 0;

    if (!patientMap.has(id)) {
      patientMap.set(id, {
        name: p.name || 'Unknown',
        id: id,
        phone: p.phone || 'N/A',
        address: p.address || 'N/A',
        totalFee: 0,
        totalPaid: 0,
        totalMedFee: 0,
        totalMedPaid: 0
      });
    }
    
    const record = patientMap.get(id);
    record.totalFee += fee;
    record.totalPaid += paid;
    record.totalMedFee += medFee;
    record.totalMedPaid += medPaid;
  });

  const pendingPatients = [];
  for (const [id, record] of patientMap.entries()) {
    const totalPending = (record.totalFee + record.totalMedFee) - (record.totalPaid + record.totalMedPaid);
    if (totalPending > 0) {
      record.totalPending = totalPending;
      pendingPatients.push(record);
    }
  }

  pendingPatients.sort((a, b) => b.totalPending - a.totalPending);

  if (pendingPatients.length === 0) {
    tbody.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";
  let html = "";
  pendingPatients.forEach(p => {
    html += `
      <tr onclick="loadInvoiceFromBalance('${p.id}', '${p.name.replace(/'/g, "\\'")}')" style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='#f0fdfa'" onmouseout="this.style.background='transparent'">
        <td style="padding: 12px; font-weight: bold; color: #334155;">${p.name}</td>
        <td style="padding: 12px; color: #64748b;">#${p.id}</td>
        <td style="padding: 12px; color: #64748b;">${p.phone}</td>
        <td style="padding: 12px; color: #64748b;">${p.address}</td>
        <td style="padding: 12px; font-weight: bold; color: #dc2626; text-align: right; font-size: 15px;">₹ ${p.totalPending}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

window.loadInvoiceFromBalance = function(patientId, patientName) {
  // Set the search filter and trigger the patient tally render to update the receipt
  document.getElementById("ptFilterPatient").value = `${patientName} (#${patientId})`;
  renderPatientTally();
}

window.showPendingBalancePopup = function(filterDate) {
  const modal = document.getElementById("pendingBalanceModal");
  const tbody = document.getElementById("popupPendingTableBody");
  const emptyMsg = document.getElementById("popupPendingEmpty");
  const modalContent = document.getElementById("pendingBalanceModalContent");
  
  if (!modal || !tbody || !emptyMsg) return;

  if (filterDate === undefined) {
    filterDate = formatDate(new Date());
  }

  const dateInput = document.getElementById("popupDateFilter");
  if (dateInput) {
    if (filterDate === 'ALL') dateInput.value = "";
    else dateInput.value = filterDate;
  }
  
  const dateLabel = document.getElementById("popupDateLabel");
  if (dateLabel) {
    if (filterDate === 'ALL') dateLabel.innerText = "Overall";
    else if (filterDate === formatDate(new Date())) dateLabel.innerText = "Today's";
    else dateLabel.innerText = filterDate + " ";
  }

  const patientMap = new Map();
  const transactionsToProcess = filterDate === 'ALL' ? allPatients : allPatients.filter(p => p.date === filterDate);

  transactionsToProcess.forEach(p => {
    if (!p.patient_id) return;
    const id = String(p.patient_id);
    
    const fee = parseFloat(p.fee) || 0;
    const paid = parseFloat(p.paid) || 0;
    const medFee = parseFloat(p.medicine_fee) || 0;
    const medPaid = parseFloat(p.medicine_paid) || 0;

    if (!patientMap.has(id)) {
      patientMap.set(id, {
        name: p.name || 'Unknown',
        id: id,
        phone: p.phone || 'N/A',
        address: p.address || 'N/A',
        totalFee: 0,
        totalPaid: 0,
        totalMedFee: 0,
        totalMedPaid: 0
      });
    }
    
    const record = patientMap.get(id);
    record.totalFee += fee;
    record.totalPaid += paid;
    record.totalMedFee += medFee;
    record.totalMedPaid += medPaid;
  });

  const pendingPatients = [];
  let grandTotalPending = 0;

  for (const [id, record] of patientMap.entries()) {
    const totalPending = (record.totalFee + record.totalMedFee) - (record.totalPaid + record.totalMedPaid);
    if (totalPending > 0) {
      record.totalPending = totalPending;
      pendingPatients.push(record);
      grandTotalPending += totalPending;
    }
  }

  pendingPatients.sort((a, b) => b.totalPending - a.totalPending);

  const totalPendingValue = document.getElementById("popupTotalPendingValue");
  const patientCount = document.getElementById("popupPatientCount");
  if (totalPendingValue) totalPendingValue.innerText = `₹ ${grandTotalPending}`;
  if (patientCount) patientCount.innerText = `(${pendingPatients.length} patients)`;

  if (pendingPatients.length === 0) {
    tbody.innerHTML = "";
    tbody.style.display = "none";
    emptyMsg.style.display = "block";
  } else {
    emptyMsg.style.display = "none";
    tbody.style.display = "flex";
    let html = "";
    pendingPatients.forEach(p => {
      html += `
        <div onclick="loadInvoiceAndClosePopup('${p.id}', '${p.name.replace(/'/g, "\\'")}')" style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
          <div style="flex: 2; font-weight: bold; color: #334155;">${p.name} <span style="color:#94a3b8; font-weight:normal; font-size:11px;">(#${p.id})</span></div>
          <div style="flex: 1.5; color: #64748b; font-size: 13px;">${p.phone}</div>
          <div style="flex: 2; color: #64748b; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">${p.address}</div>
          <div style="flex: 1.5; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding-right: 20px;">
            <span style="font-weight: 800; color: #ea580c; font-size: 14px;">₹ ${p.totalPending}</span>
            <i class="fas fa-chevron-right" style="color: #cbd5e1; font-size: 12px; transition: color 0.2s, transform 0.2s;" onmouseover="this.style.color='#ea580c'; this.style.transform='translateX(3px)';" onmouseout="this.style.color='#cbd5e1'; this.style.transform='none';"></i>
          </div>
        </div>
      `;
    });
    tbody.innerHTML = html;
  }

  modal.style.display = "flex";
  setTimeout(() => {
    modal.style.opacity = "1";
    modalContent.style.transform = "translateY(0)";
  }, 10);
}

window.closePendingBalancePopup = function() {
  const modal = document.getElementById("pendingBalanceModal");
  const modalContent = document.getElementById("pendingBalanceModalContent");
  if (!modal) return;
  modal.style.opacity = "0";
  modalContent.style.transform = "translateY(-20px)";
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}

window.loadInvoiceAndClosePopup = function(patientId, patientName) {
  closePendingBalancePopup();
  // Make sure we switch to the Patients Tally section to see the invoice
  const ptTabBtn = Array.from(document.querySelectorAll('.tabs-nav .tab-btn')).find(btn => btn.innerText.includes("Patients Tally"));
  if(ptTabBtn) switchTab('patientsTallyTab', ptTabBtn);
  loadInvoiceFromBalance(patientId, patientName);
}

// --- Internet Connection Monitor ---
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
  const banner = document.getElementById("offlineBanner");
  if (!banner) return;
  if (navigator.onLine) {
    banner.style.display = "none";
  } else {
    banner.style.display = "block";
  }
}


// Initial check on load
document.addEventListener("DOMContentLoaded", updateOnlineStatus);

// ====================================================
// EXCEL BACKUP EXPORT FUNCTION
// Exports the Day-wise Patient Record table to Excel
// ====================================================
window.exportTableToExcel = function() {
  const dateFilterEl = document.getElementById("obsDateFilter");
  const obsDoctorFilterEl = document.getElementById("obsDoctorFilter");

  const targetDateStr = (dateFilterEl && dateFilterEl.value) ? dateFilterEl.value : formatDate(new Date());
  const selectedDoctorFilter = obsDoctorFilterEl ? obsDoctorFilterEl.value.trim() : "";

  // Filter the same way as renderObservationList
  const obsPatients = allPatients.filter(p => {
    if (!p.checkup_id || String(p.checkup_id).trim() === "") return false;
    let pDateStr = p.date;
    if (p.date) {
      const parsedDate = new Date(p.date);
      if (!isNaN(parsedDate)) pDateStr = formatDate(parsedDate);
    }
    if (pDateStr !== targetDateStr) return false;
    if (selectedDoctorFilter !== "") {
      if ((p.doctor || "").trim() !== selectedDoctorFilter) return false;
    }
    return true;
  });

  // Sort by token number
  obsPatients.sort((a, b) => {
    const ta = parseInt(a.token_no) || 9999;
    const tb = parseInt(b.token_no) || 9999;
    return ta - tb;
  });

  if (obsPatients.length === 0) {
    alert("No records found for the selected date/filter to export.");
    return;
  }

  // Helper: wrap cell value safely for CSV
  const csvCell = (val) => {
    const str = String(val === null || val === undefined ? "" : val);
    // Escape double-quotes by doubling them, then wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    "Token No", "Pat. ID", "Chk. ID", "Date", "Name",
    "Phone", "Address", "Doctor", "Visit",
    "Dr. Fee", "Paid Dr. Fee", "Med. Fee", "Paid Med. Fee",
    "Validity Upto", "Status", "Notes"
  ];

  const rows = [headers.map(csvCell).join(",")];

  obsPatients.forEach(p => {
    const drFee = parseFloat(p.fee) || 0;
    const paidDrFee = parseFloat(p.paid) || 0;
    const medFee = parseFloat(p.medicine_fee) || 0;
    const paidMedFee = parseFloat(p.medicine_paid) || 0;

    rows.push([
      csvCell(p.token_no),
      csvCell(p.patient_id),
      csvCell(p.checkup_id),
      csvCell(p.date),
      csvCell(p.name),
      csvCell(p.phone),
      csvCell(p.address),
      csvCell(p.doctor),
      csvCell(p.visit),
      csvCell(drFee),
      csvCell(paidDrFee),
      csvCell(medFee),
      csvCell(paidMedFee),
      csvCell(p.validity_upto),
      csvCell(p.status),
      csvCell(p.notes)
    ].join(","));
  });

  const csvContent = "\uFEFF" + rows.join("\r\n"); // BOM for Excel UTF-8 support

  const doctorLabel = selectedDoctorFilter ? `_${selectedDoctorFilter.replace(/\s+/g, "_")}` : "";
  const fileName = `Shehjaar_Medicate_${targetDateStr}${doctorLabel}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
