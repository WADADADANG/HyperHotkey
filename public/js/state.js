import { currentLang, TRANSLATIONS, t } from './i18n.js';
import { syncActionFromDom, renderActions } from './components/actions.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export let fullConfig = { activeProfile: 'Default', profiles: {} };
export let currentEditProfile = 'Default';
export let activeClients = [1];

let renderActionsCallback = null;

export function setRenderActionsCallback(cb) {
  renderActionsCallback = cb;
}

export function setCurrentEditProfile(val) {
  currentEditProfile = val;
}

export function setFullConfig(cfg) {
  fullConfig = cfg;
}

export function setActiveClients(clients) {
  activeClients = clients;
}

export function loadConfig() {
  fetch('/api/config', { cache: 'no-store' })
    .then(r => r.json())
    .then(cfg => {
      if (cfg && cfg.profiles) {
        fullConfig = cfg;
        currentEditProfile = cfg.activeProfile || 'Default';
        populateProfileDropdowns();
        loadGlobalSettingsToUI();
        loadProfileToUI(fullConfig.profiles[currentEditProfile]);
        pollActiveClients();
      }
    })
    .catch(err => {
      if (typeof window.toast === 'function') {
        window.toast(t('toastLoadConfigErr') + ': ' + err.message, 'error');
      }
    });
}

export function syncGlobalSettingsFromDOM() {
  if (!fullConfig.globalSettings) fullConfig.globalSettings = {};
  const gs = fullConfig.globalSettings;

  const urlInput = document.getElementById('target-url-keyword');
  if (urlInput) {
    gs.targetUrlKeyword = urlInput.value.trim() || 'universe.flyff.com';
  }

  const checkbox = document.getElementById('enable-overlay-checkbox');
  if (checkbox) {
    gs.enableOverlay = !!checkbox.checked;
  }

  const suspendInput = document.getElementById('suspend-hotkey-input');
  if (suspendInput) {
    gs.suspendHotkey = suspendInput.value.trim();
  }

  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  const gmMin = document.getElementById('ghost-mouse-interval-min');
  const gmMax = document.getElementById('ghost-mouse-interval-max');
  const gmOffset = document.getElementById('ghost-mouse-max-offset');

  if (gmEnabled) {
    gs.ghostMouseJitter = {
      enabled: !!gmEnabled.checked,
      intervalMin: gmMin ? parseInt(gmMin.value) || 8000 : 8000,
      intervalMax: gmMax ? parseInt(gmMax.value) || 25000 : 25000,
      maxOffset: gmOffset ? parseInt(gmOffset.value) || 12 : 12
    };
  }

  if (!gs.clientAliases) gs.clientAliases = {};
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`client-alias-${i}`);
    if (el) {
      gs.clientAliases[String(i)] = el.value.trim();
    }
  }

  // Mirror globalSettings to all profiles for backward compatibility
  Object.values(fullConfig.profiles || {}).forEach(prof => {
    prof.targetUrlKeyword = gs.targetUrlKeyword;
    prof.enableOverlay = gs.enableOverlay;
    prof.suspendHotkey = gs.suspendHotkey;
    prof.ghostMouseJitter = gs.ghostMouseJitter;
    prof.clientAliases = gs.clientAliases;
    if (gs.clientUserAgents) prof.clientUserAgents = gs.clientUserAgents;
    if (gs.clientProxies) prof.clientProxies = gs.clientProxies;
  });
}

export function saveCurrentProfile() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  if (profile.actions && Array.isArray(profile.actions)) {
    profile.actions.forEach(a => syncActionFromDom(a.id));
  }

  syncGlobalSettingsFromDOM();

  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullConfig)
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        if (typeof window.toast === 'function') {
          window.toast(t('toastProfileSaved').replace('{name}', currentEditProfile), 'success');
        }
      } else {
        if (typeof window.toast === 'function') {
          window.toast(t('toastSaveFailed') + (res.error || 'Unknown'), 'error');
        }
      }
    })
    .catch(err => {
      console.error('Failed to save config:', err);
    });
}

export function populateProfileDropdowns() {
  const names = Object.keys(fullConfig.profiles || {});

  const selectEl = document.getElementById('profile-select');
  if (selectEl) {
    const prevSel = selectEl.value;
    selectEl.innerHTML = '';
    names.forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      selectEl.appendChild(o);
    });
    if (names.includes(prevSel)) selectEl.value = prevSel;
    else selectEl.value = currentEditProfile;
  }

  const copyEl = document.getElementById('copy-from-select');
  if (copyEl) {
    const prevCopy = copyEl.value;
    copyEl.innerHTML = '';

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = TRANSLATIONS[currentLang] ? TRANSLATIONS[currentLang].emptyProfile : 'None (Empty Profile)';
    copyEl.appendChild(optNone);

    names.forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      copyEl.appendChild(o);
    });
    if (prevCopy !== undefined) copyEl.value = prevCopy;
  }

  const badge = document.getElementById('active-profile-badge');
  if (badge) {
    badge.textContent = '● ' + fullConfig.activeProfile;
    badge.style.display = 'block';
    badge.style.opacity = currentEditProfile === fullConfig.activeProfile ? '1' : '0.4';
  }
}

export function onProfileSelectChange() {
  const selectEl = document.getElementById('profile-select');
  if (selectEl) {
    syncGlobalSettingsFromDOM();
    currentEditProfile = selectEl.value;
    populateProfileDropdowns();
    loadProfileToUI(fullConfig.profiles[currentEditProfile]);
  }
}

export function loadGlobalSettingsToUI() {
  const gs = fullConfig.globalSettings || {};
  
  const targetUrlInput = document.getElementById('target-url-keyword');
  if (targetUrlInput) targetUrlInput.value = gs.targetUrlKeyword || 'universe.flyff.com';

  const checkbox = document.getElementById('enable-overlay-checkbox');
  if (checkbox) checkbox.checked = !!gs.enableOverlay;

  const suspendInput = document.getElementById('suspend-hotkey-input');
  if (suspendInput) suspendInput.value = gs.suspendHotkey || '';

  const gmj = gs.ghostMouseJitter || {};
  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  if (gmEnabled) {
    gmEnabled.checked = !!gmj.enabled;
    toggleGhostMouseSettings();
  }
  const gmMin = document.getElementById('ghost-mouse-interval-min');
  if (gmMin) gmMin.value = gmj.intervalMin || 8000;
  const gmMax = document.getElementById('ghost-mouse-interval-max');
  if (gmMax) gmMax.value = gmj.intervalMax || 25000;
  const gmOffset = document.getElementById('ghost-mouse-max-offset');
  if (gmOffset) gmOffset.value = gmj.maxOffset || 12;

  renderClientToggles(activeClients, disabledClients);

  const aliases = gs.clientAliases || {};
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`client-alias-${i}`);
    if (el) el.value = aliases[String(i)] || '';
  }
}

export function loadProfileToUI(p) {
  if (!p) return;
  loadGlobalSettingsToUI();
  if (!p.actions) p.actions = [];
  renderActions(p.actions);
}

export function toggleGhostMouseSettings() {
  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  const gmSettings = document.getElementById('ghost-mouse-settings');
  if (gmEnabled && gmSettings) {
    gmSettings.style.display = gmEnabled.checked ? 'flex' : 'none';
  }
}

export function activateProfile() {
  fetch('/api/profile/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: currentEditProfile })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        fullConfig.activeProfile = currentEditProfile;
        populateProfileDropdowns();
        if (typeof window.toast === 'function') {
          window.toast(t('toastProfileSaved').replace('{name}', currentEditProfile), 'success');
        }
      }
    });
}

export function openNewProfileModal() {
  document.getElementById('new-profile-name').value = '';
  document.getElementById('new-profile-modal').classList.add('show');
}

export function confirmNewProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  if (!name) {
    if (typeof window.toast === 'function') window.toast(t('toastEnterProfileName'), 'error');
    return;
  }
  const copyFrom = document.getElementById('copy-from-select').value;
  let newActions = [];
  let newTargetUrl = 'universe.flyff.com';
  let newOverlay = false;
  let newSuspend = '';

  if (copyFrom && fullConfig.profiles[copyFrom]) {
    const src = fullConfig.profiles[copyFrom];
    newActions = JSON.parse(JSON.stringify(src.actions || []));
    newTargetUrl = src.targetUrlKeyword || 'universe.flyff.com';
    newOverlay = !!src.enableOverlay;
    newSuspend = src.suspendHotkey || '';
  }

  fullConfig.profiles[name] = {
    targetUrlKeyword: newTargetUrl,
    enableOverlay: newOverlay,
    suspendHotkey: newSuspend,
    actions: newActions
  };
  currentEditProfile = name;
  document.getElementById('new-profile-modal').classList.remove('show');
  populateProfileDropdowns();
  loadProfileToUI(fullConfig.profiles[name]);
  saveCurrentProfile();
  if (typeof window.toast === 'function') window.toast(t('toastProfileCreated').replace('{name}', name), 'success');
}

export function openRenameProfileModal() {
  document.getElementById('rename-profile-name').value = currentEditProfile;
  document.getElementById('rename-profile-modal').classList.add('show');
}

export function confirmRenameProfile() {
  const newName = document.getElementById('rename-profile-name').value.trim();
  if (!newName) {
    if (typeof window.toast === 'function') window.toast(t('toastEnterProfileName'), 'error');
    return;
  }
  if (newName === currentEditProfile) {
    document.getElementById('rename-profile-modal').classList.remove('show');
    return;
  }
  const oldProfile = fullConfig.profiles[currentEditProfile];
  delete fullConfig.profiles[currentEditProfile];
  fullConfig.profiles[newName] = oldProfile;
  if (fullConfig.activeProfile === currentEditProfile) {
    fullConfig.activeProfile = newName;
  }
  currentEditProfile = newName;
  document.getElementById('rename-profile-modal').classList.remove('show');
  populateProfileDropdowns();
  loadProfileToUI(fullConfig.profiles[newName]);
  saveCurrentProfile();
  if (typeof window.toast === 'function') window.toast(t('toastProfileRenamed').replace('{name}', newName), 'success');
}

export function deleteProfile() {
  if (currentEditProfile === 'Default') {
    if (typeof window.toast === 'function') window.toast(t('toastDeleteDefaultErr'), 'error');
    return;
  }
  if (confirm(t('confirmDeleteProfile').replace('{name}', currentEditProfile))) {
    delete fullConfig.profiles[currentEditProfile];
    if (fullConfig.activeProfile === currentEditProfile) {
      fullConfig.activeProfile = 'Default';
    }
    currentEditProfile = 'Default';
    populateProfileDropdowns();
    loadProfileToUI(fullConfig.profiles['Default']);
    saveCurrentProfile();
    if (typeof window.toast === 'function') window.toast(t('toastProfileDeleted'), 'success');
  }
}

export let disabledClients = [];

export function renderClientToggles(activeList = activeClients, disabledList = disabledClients) {
  const container = document.getElementById('client-toggles-container');
  if (!container) return;
  container.innerHTML = '';

  const currentProf = fullConfig.profiles[currentEditProfile];
  const aliases = currentProf ? (currentProf.clientAliases || {}) : {};

  const activeStrList = (activeList || []).map(String);
  const disabledStrList = (disabledList || []).map(String);

  for (let clientIdx = 1; clientIdx <= 8; clientIdx++) {
    const sIdx = String(clientIdx);
    const customAlias = aliases[sIdx] || aliases[clientIdx] || '';
    const isActive = activeStrList.includes(sIdx);
    const isDisabled = disabledStrList.includes(sIdx);

    let statusText = '⚪ OFFLINE';
    let statusStyle = 'background:rgba(255,255,255,0.05); color:var(--muted);';
    let cardBorder = 'border:1px solid rgba(255,255,255,0.08);';

    if (isActive) {
      if (isDisabled) {
        statusText = '🔴 PAUSED';
        statusStyle = 'background:rgba(239,68,68,0.2); color:#fca5a5;';
        cardBorder = 'border:1px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.04);';
      } else {
        statusText = '🟢 ACTIVE';
        statusStyle = 'background:rgba(16,185,129,0.2); color:#6ee7b7;';
        cardBorder = 'border:1px solid rgba(16,185,129,0.4); background:rgba(16,185,129,0.04);';
      }
    }

    const card = document.createElement('div');
    card.className = 'client-card';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      ${cardBorder}
      transition: all 0.2s ease;
    `;

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:11px; font-weight:700; color:var(--text);">Client ${clientIdx}</span>
          <button type="button" class="btn btn-ghost" onclick="openClientSettingsModal(${clientIdx})" style="padding:0 3px; height:18px; font-size:10px; border:none; background:transparent; color:var(--muted); cursor:pointer; transition:transform 0.2s;" title="Anti-Detect User-Agent & Proxy Settings">⚙️</button>
        </div>
        <span style="font-size:9px; font-weight:700; padding:2px 5px; border-radius:4px; ${statusStyle}">${statusText}</span>
      </div>
      <input type="text" id="client-alias-${clientIdx}" value="${escapeHtml(customAlias)}" placeholder="Alias (e.g. RM)" style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:3px 6px; color:var(--text); font-size:11px; outline:none; text-align:center; height:24px;" onchange="saveCurrentProfile()">
      <div style="display:flex; gap:4px; margin-top:2px;">
        ${!isActive ? `
          <button type="button" class="btn btn-sm btn-ghost" onclick="launchClient(${clientIdx})" style="flex:1; border-color:var(--primary); color:var(--primary); font-size:10px; padding:4px 0; height:26px; border-radius:6px; font-weight:700;">➕ Launch</button>
        ` : `
          <button type="button" class="btn btn-sm ${isDisabled ? 'btn-ghost' : 'btn-danger'}" onclick="toggleClientEnable(${clientIdx})" style="flex:1; font-size:10px; padding:4px 0; height:26px; border-radius:6px; font-weight:700; ${isDisabled ? 'border-color:#10b981; color:#6ee7b7;' : ''}">${isDisabled ? '▶ Resume' : '⏸ Pause'}</button>
          <button type="button" class="btn btn-sm btn-ghost" onclick="closeClient(${clientIdx})" style="border-color:#ef4444; color:#ef4444; font-size:10px; padding:0 6px; height:26px; border-radius:6px;" title="Close Browser Window">❌</button>
        `}
      </div>
    `;
    container.appendChild(card);
  }
}

export function launchClient(clientIdx) {
  if (typeof window.toast === 'function') {
    window.toast(t('toastLaunchingClient') || `Launching Client ${clientIdx}...`, 'info');
  }
  fetch('/api/client/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        if (res.activeClients) activeClients = res.activeClients;
        if (res.disabledClients) disabledClients = res.disabledClients;
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          window.toast(`Client ${clientIdx} launched successfully!`, 'success');
        }
      } else if (res && res.error) {
        if (typeof window.toast === 'function') window.toast(`Launch failed: ${res.error}`, 'error');
      }
    })
    .catch(err => {
      console.error('Failed to launch client:', err);
    });
}

export function closeClient(clientIdx) {
  fetch('/api/client/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        if (res.activeClients) activeClients = res.activeClients;
        if (res.disabledClients) disabledClients = res.disabledClients;
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          window.toast(`Client ${clientIdx} closed.`, 'warning');
        }
      }
    })
    .catch(err => {
      console.error('Failed to close client:', err);
    });
}

export function toggleClientEnable(clientIdx) {
  fetch('/api/client/toggle-enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        disabledClients = res.disabledClients || [];
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          const isDisabled = disabledClients.includes(String(clientIdx)) || disabledClients.includes(clientIdx);
          const msg = isDisabled 
            ? (currentLang === 'en' ? `Paused Client ${clientIdx} (Skipped from hotkeys)` : `ปิดพัก Client ${clientIdx} (ข้ามการกดปุ่ม)`)
            : (currentLang === 'en' ? `Activated Client ${clientIdx}` : `เปิดใช้งาน Client ${clientIdx}`);
          window.toast(msg, isDisabled ? 'warning' : 'success');
        }
      }
    })
    .catch(err => {
      console.error('Failed to toggle client enable state:', err);
    });
}

export function pollActiveClients() {
  fetch('/api/active-clients', { cache: 'no-store' })
    .then(r => r.json())
    .then(res => {
      const list = (res && res.activeClients) ? res.activeClients : (Array.isArray(res) ? res : null);
      if (res && res.disabledClients) {
        disabledClients = res.disabledClients;
      }
      if (Array.isArray(list) && list.length > 0) {
        const changed = JSON.stringify(activeClients) !== JSON.stringify(list);
        activeClients = list;
        renderClientToggles(activeClients, disabledClients);
        if (changed && fullConfig.profiles[currentEditProfile]) {
          renderActions(fullConfig.profiles[currentEditProfile].actions);
        }
      } else {
        renderClientToggles(activeClients, disabledClients);
      }
    })
    .catch(() => {});
}
