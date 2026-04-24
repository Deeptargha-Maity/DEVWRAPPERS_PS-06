/* ── ER Command — app.js ──────────────────────────────────────────────────── */

const API = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

let ws = null;
let wsReconnectTimer = null;
let state = {
  patients: [],
  beds: { total: 50, occupied: 0, reserved: 0, available: 50, beds: [] },
  mci_mode: false,
  reservations: [],
};
let activeFilter = 'all';

/* ── SVG Icon Library ─────────────────────────────────────────────────────── */
const ICONS = {
  alert: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  bed: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2V10c0-2.21-1.79-4-4-4z"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
  ambulance: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
  queue: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
};

/* ── WebSocket ────────────────────────────────────────────────────────────── */
function connectWS() {
  setWsStatus('connecting');
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setWsStatus('connected');
    clearTimeout(wsReconnectTimer);
    startPing();
  };

  ws.onclose = () => {
    setWsStatus('disconnected');
    wsReconnectTimer = setTimeout(connectWS, 3000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleEvent(msg.event, msg.data);
  };
}

let pingInterval = null;
function startPing() {
  clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping');
  }, 20000);
}

function setWsStatus(s) {
  const dot = document.getElementById('ws-dot');
  const label = document.getElementById('ws-label');
  dot.className = 'ws-dot ' + s;
  label.textContent = s === 'connected' ? 'Live' : s === 'connecting' ? 'Connecting' : 'Reconnecting';
}

/* ── Event Handler ────────────────────────────────────────────────────────── */
function handleEvent(event, data) {
  switch (event) {
    case 'full_state':
      state.patients = data.patients || [];
      state.beds = data.beds || state.beds;
      state.mci_mode = data.mci_mode ?? state.mci_mode;
      state.reservations = data.reservations || [];
      renderAll();
      break;
    case 'priority_updated':
      state.patients = data.patients || [];
      renderQueue();
      renderStats();
      break;
    case 'patient_added':
      showAlert(`Patient <strong>${data.name}</strong> added — ID: ${data.id}`, 'success');
      break;
    case 'bed_assigned':
      showAlert(`Bed <strong>#${data.bed_id}</strong> assigned to patient ${data.patient_id}`, 'success');
      break;
    case 'bed_released':
      showAlert(`Bed <strong>#${data.bed_id}</strong> is now available`, 'info');
      break;
    case 'reservation_created':
      showAlert(`Bed <strong>#${data.bed_id}</strong> reserved for <strong>${data.patient_name}</strong> (${data.expires_in_minutes} min)`, 'warning');
      break;
    case 'reservation_expired':
      showAlert(`Reservation ${data.reservation_id} expired — bed released`, 'info');
      break;
    case 'mode_changed':
      state.mci_mode = data.mci_mode;
      updateMCIUI();
      showAlert(data.mci_mode ? 'MCI Mode ACTIVATED — Survival priority engaged' : 'Normal mode restored', data.mci_mode ? 'critical' : 'success');
      break;
    case 'pong':
      break;
  }
}

/* ── Render All ───────────────────────────────────────────────────────────── */
function renderAll() {
  renderQueue();
  renderBedGrid();
  renderStats();
  updateMCIUI();
}

/* ── Patient Queue ────────────────────────────────────────────────────────── */
function renderQueue() {
  const container = document.getElementById('patient-queue');

  // Handle reservations tab
  if (activeFilter === 'reservations') {
    const res = state.reservations || [];
    document.getElementById('queue-count').textContent = `(${res.length} reservation${res.length !== 1 ? 's' : ''})`;
    if (res.length === 0) {
      container.innerHTML = `
        <div class="empty-queue">
          <div class="eq-icon">${ICONS.ambulance}</div>
          <p>No active reservations</p>
          <div class="eq-sub">Use the Pre-Arrival form to reserve a bed</div>
        </div>`;
      return;
    }
    container.innerHTML = res.map(r => `
      <div class="reservation-item" id="res-${r.id}">
        <div class="reservation-info">
          <div class="res-name">${escHtml(r.patient_name)}</div>
          <div class="res-meta">${r.ambulance_id} · Bed #${r.bed_id} · ${r.severity} · ${r.expires_in}m left</div>
        </div>
        <button class="btn-cancel-res" data-rid="${r.id}">Cancel</button>
      </div>`).join('');
    container.querySelectorAll('.btn-cancel-res').forEach(btn => {
      btn.addEventListener('click', () => cancelReservation(btn.dataset.rid));
    });
    return;
  }

  let patients = [...state.patients];

  if (activeFilter !== 'all') {
    patients = patients.filter(p => p.status === activeFilter);
  }

  document.getElementById('queue-count').textContent = `(${patients.length} patient${patients.length !== 1 ? 's' : ''})`;

  if (patients.length === 0) {
    container.innerHTML = `
      <div class="empty-queue">
        <div class="eq-icon">${ICONS.queue}</div>
        <p>${activeFilter === 'all' ? 'No patients in the system' : `No ${activeFilter} patients`}</p>
        <div class="eq-sub">${activeFilter === 'all' ? 'Add a patient using the form to get started' : 'Try switching filters to see other patients'}</div>
      </div>`;
    return;
  }

  container.innerHTML = patients.map((p, idx) => buildPatientCard(p, idx + 1)).join('');

  // Attach event listeners
  container.querySelectorAll('.btn-assign').forEach(btn => {
    btn.addEventListener('click', () => assignBed(btn.dataset.id));
  });
  container.querySelectorAll('.btn-discharge').forEach(btn => {
    btn.addEventListener('click', () => dischargePatient(btn.dataset.id));
  });
  container.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removePatient(btn.dataset.id));
  });
}

function buildPatientCard(p, rank) {
  const sev = p.severity;
  const waitStr = formatWait(p.waiting_minutes);
  const scoreStr = p.priority_score.toFixed(1);
  const bedTag = p.bed_id ? `<span class="tag bed">${ICONS.bed} Bed ${p.bed_id}</span>` : '';
  let statusText = 'Waiting';
  if (p.status === 'assigned') statusText = 'Assigned';
  if (p.status === 'discharged') statusText = 'Discharged';
  const statusTag = `<span class="tag status-${p.status}">${statusText}</span>`;

  const assignBtn = p.status === 'waiting'
    ? `<button class="btn-sm btn-assign" data-id="${p.id}" id="assign-${p.id}">Assign Bed</button>` : '';
  const dischargeBtn = p.status === 'assigned'
    ? `<button class="btn-sm btn-discharge" data-id="${p.id}">Discharge</button>` : '';
  const removeBtn = `<button class="btn-sm btn-remove" data-id="${p.id}">Remove</button>`;

  return `
    <div class="patient-card ${sev}" id="card-${p.id}">
      <div class="priority-badge ${sev}">
        <span>#${rank}</span>
        <small>${scoreStr}</small>
      </div>
      <div class="patient-info">
        <div class="patient-name">${escHtml(p.name)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted)">· ${p.id} · Age ${p.age}</span></div>
        <div class="patient-meta">${severityLabel(sev)} · Survival: ${(p.survival_probability * 100).toFixed(0)}%</div>
        <div class="patient-complaint">"${escHtml(p.chief_complaint)}"</div>
        <div class="patient-tags">
          <span class="tag wait">${ICONS.clock} ${waitStr}</span>
          ${bedTag}
          ${statusTag}
        </div>
      </div>
      <div class="patient-actions">
        ${assignBtn}
        ${dischargeBtn}
        ${removeBtn}
      </div>
    </div>`;
}

/* ── Bed Grid ─────────────────────────────────────────────────────────────── */
function renderBedGrid() {
  const grid = document.getElementById('bed-grid');
  const beds = state.beds.beds || [];
  grid.innerHTML = beds.map(b => {
    let cls = 'available';
    if (b.is_occupied) { cls = 'occupied'; }
    else if (b.reserved_by) { cls = 'reserved'; }
    const title = b.is_occupied ? `Patient: ${b.patient_id}` : b.reserved_by ? `Reserved: ${b.reservation_patient || '?'}` : 'Available';
    return `<div class="bed-cell ${cls}" title="${title}">
      <span class="bed-status-dot"></span>
      <span class="bed-num">${b.id}</span>
    </div>`;
  }).join('');

  const avail = state.beds.available ?? 0;
  const occ = state.beds.occupied ?? 0;
  const res = state.beds.reserved ?? 0;
  document.getElementById('bed-summary-label').textContent =
    `${avail} available · ${occ} occupied · ${res} reserved`;
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
function renderStats() {
  const critical = state.patients.filter(p => p.severity === 'critical' && p.status === 'waiting').length;
  const waiting = state.patients.filter(p => p.status === 'waiting').length;
  animateCount('stat-critical', critical);
  animateCount('stat-waiting', waiting);
  animateCount('stat-available', state.beds.available ?? 0);
  animateCount('stat-total', state.patients.length);

  // Auto-alert for critical patients
  if (critical > 0 && waiting > 0) {
    const names = state.patients
      .filter(p => p.severity === 'critical' && p.status === 'waiting')
      .map(p => p.name).join(', ');
    showAlert(`${critical} critical patient(s) awaiting beds: <strong>${names}</strong>`, 'critical', 'crit-alert');
  } else {
    const el = document.getElementById('alert-crit-alert');
    if (el) el.remove();
  }

  if ((state.beds.available ?? 50) === 0) {
    showAlert('All beds occupied — consider emergency discharge procedures.', 'critical', 'no-beds');
  } else {
    const el = document.getElementById('alert-no-beds');
    if (el) el.remove();
  }
}

/* ── Reservations (rendered inside queue tab) ─────────────────────────────── */
function renderReservations() {
  if (activeFilter === 'reservations') renderQueue();
}

/* ── MCI Mode UI ──────────────────────────────────────────────────────────── */
function updateMCIUI() {
  const banner = document.getElementById('mci-banner');
  const chip = document.getElementById('mode-chip');
  const toggle = document.getElementById('mci-toggle');
  banner.style.display = state.mci_mode ? 'block' : 'none';
  chip.textContent = state.mci_mode ? 'MCI MODE' : 'NORMAL MODE';
  chip.className = 'mode-chip' + (state.mci_mode ? ' mci' : '');
  toggle.checked = state.mci_mode;
}

/* ── API Calls ────────────────────────────────────────────────────────────── */
async function assignBed(patientId) {
  const btn = document.getElementById(`assign-${patientId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning…'; }
  try {
    const res = await fetch(`${API}/beds/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed');
    await refreshState();
  } catch (err) {
    showAlert(err.message, 'critical');
    if (btn) { btn.disabled = false; btn.textContent = 'Assign Bed'; }
  }
}

async function dischargePatient(patientId) {
  try {
    const res = await fetch(`${API}/beds/release/${patientId}`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    await refreshState();
  } catch (err) {
    showAlert(err.message, 'critical');
  }
}

async function removePatient(patientId) {
  if (!confirm('Remove this patient from the system?')) return;
  try {
    const res = await fetch(`${API}/patients/${patientId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    await refreshState();
  } catch (err) {
    showAlert(err.message, 'critical');
  }
}

async function cancelReservation(resId) {
  try {
    const res = await fetch(`${API}/reserve/${resId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    await refreshState();
    showAlert('Reservation cancelled', 'info');
  } catch (err) {
    showAlert(err.message, 'critical');
  }
}

async function refreshState() {
  try {
    const [pRes, bRes, sRes] = await Promise.all([
      fetch(`${API}/patients`),
      fetch(`${API}/beds`),
      fetch(`${API}/system/status`),
    ]);
    const pData = await pRes.json();
    const bData = await bRes.json();
    const sData = await sRes.json();
    state.patients = pData.patients || [];
    state.beds = bData;
    state.mci_mode = sData.mci_mode;
    state.reservations = sData.reservations || [];
    renderAll();
  } catch (e) {
    console.error('Refresh failed', e);
  }
}

/* ── Form Submissions ─────────────────────────────────────────────────────── */
document.getElementById('add-patient-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const body = {
      name: document.getElementById('p-name').value.trim(),
      age: parseInt(document.getElementById('p-age').value),
      severity: document.getElementById('p-severity').value,
      chief_complaint: document.getElementById('p-complaint').value.trim(),
      survival_probability: parseFloat(document.getElementById('p-survival').value),
    };
    const res = await fetch(`${API}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed');
    e.target.reset();
    document.getElementById('p-survival').value = '0.75';
    await refreshState();
  } catch (err) {
    showAlert(err.message, 'critical');
  } finally {
    btn.disabled = false; btn.textContent = 'Add to Queue';
  }
});

document.getElementById('reserve-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Reserving…';
  try {
    const body = {
      ambulance_id: document.getElementById('r-ambulance').value.trim(),
      patient_name: document.getElementById('r-patient').value.trim(),
      severity: document.getElementById('r-severity').value,
      eta_minutes: parseInt(document.getElementById('r-eta').value),
    };
    const res = await fetch(`${API}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed');
    e.target.reset();
    document.getElementById('r-eta').value = '15';
    await refreshState();
  } catch (err) {
    showAlert(err.message, 'critical');
  } finally {
    btn.disabled = false; btn.textContent = 'Reserve Bed';
  }
});

document.getElementById('mci-toggle').addEventListener('change', async (e) => {
  try {
    const res = await fetch(`${API}/system/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mci_mode: e.target.checked }),
    });
    if (!res.ok) throw new Error('Failed to update mode');
  } catch (err) {
    showAlert(err.message, 'critical');
    e.target.checked = !e.target.checked;
  }
});

/* ── Filter Buttons ───────────────────────────────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderQueue();
  });
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function showAlert(msg, type = 'info', id = null) {
  const box = document.getElementById('alert-box');
  const alertId = 'alert-' + (id || Date.now());
  const existing = document.getElementById(alertId);
  const iconMap = { critical: ICONS.error, warning: ICONS.alert, success: ICONS.check, info: ICONS.info };
  const icon = iconMap[type] || ICONS.info;
  if (existing) { existing.innerHTML = `${icon}<span>${msg}</span>`; return; }
  const div = document.createElement('div');
  div.className = `alert ${type}`;
  div.id = alertId;
  div.innerHTML = `${icon}<span>${msg}</span>`;
  box.prepend(div);
  if (!id) setTimeout(() => div.remove(), 5000);
}

function formatWait(mins) {
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.floor(mins)}m`;
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return `${h}h ${m}m`;
}

function severityLabel(s) {
  return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[s] || s;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  // Smooth counter animation
  const duration = 400;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(current + (target - current) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
connectWS();
refreshState();

// Refresh every 30 seconds as fallback
setInterval(refreshState, 30000);
