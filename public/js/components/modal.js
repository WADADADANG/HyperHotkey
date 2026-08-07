import { currentLang, TRANSLATIONS } from '../i18n.js';
import { fullConfig, currentEditProfile, saveCurrentProfile } from '../state.js';
import { escapeHtml } from '../cooldown.js';

const USER_AGENT_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
];

export function openAntiDetectModal() {
  const modal = document.getElementById('antidetect-modal');
  const listContainer = document.getElementById('antidetect-client-list');
  if (!modal || !listContainer) return;

  const profile = fullConfig.profiles[currentEditProfile];
  const aliases = profile.clientAliases || {};
  const userAgents = profile.clientUserAgents || {};

  listContainer.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const alias = aliases[String(i)] || `Client ${i}`;
    const ua = userAgents[String(i)] || '';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';
    row.style.borderBottom = '1px dashed rgba(255,255,255,0.05)';
    row.style.paddingBottom = '10px';

    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="font-size:12px; font-weight:700; color:var(--text);">${escapeHtml(alias)}</span>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-ghost btn-random-ua" data-client-idx="${i}" style="padding:2px 8px; font-size:11px; border-color:#a855f7; color:#a855f7; background:rgba(168,85,247,0.05); height:24px; cursor:pointer;">🎲 Random</button>
          <button type="button" class="btn btn-ghost btn-clear-ua" data-client-idx="${i}" style="padding:2px 8px; font-size:11px; border-color:var(--border); color:var(--muted); height:24px; cursor:pointer;">✕ Clear</button>
        </div>
      </div>
      <input type="text" id="anti-ua-${i}" value="${escapeHtml(ua)}" placeholder="${currentLang === 'en' ? 'Default Browser User-Agent (Empty)' : 'ใช้ค่าเริ่มต้นของเบราว์เซอร์ (ค่าว่าง)'}"
        style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:6px 10px; color:var(--text); font-family:'JetBrains Mono'; font-size:11px; outline:none; width:100%; height:32px;">
    `;
    listContainer.appendChild(row);
  }

  listContainer.querySelectorAll('.btn-random-ua').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-client-idx');
      randomizeUserAgent(idx);
    });
  });

  listContainer.querySelectorAll('.btn-clear-ua').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-client-idx');
      clearUserAgent(idx);
    });
  });

  modal.classList.add('show');
}

export function closeAntiDetectModal() {
  const modal = document.getElementById('antidetect-modal');
  if (modal) modal.classList.remove('show');
}

export function randomizeUserAgent(idx) {
  const input = document.getElementById(`anti-ua-${idx}`);
  if (input) {
    const rand = USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
    input.value = rand;
  }
}

export function randomizeAllUserAgents() {
  for (let i = 1; i <= 8; i++) {
    randomizeUserAgent(i);
  }
}

export function clearUserAgent(idx) {
  const input = document.getElementById(`anti-ua-${idx}`);
  if (input) {
    input.value = '';
  }
}

export function saveAntiDetectSettings() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;
  if (!profile.clientUserAgents) profile.clientUserAgents = {};

  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`anti-ua-${i}`);
    if (input) {
      profile.clientUserAgents[String(i)] = input.value.trim();
    }
  }

  saveCurrentProfile();
  closeAntiDetectModal();
  if (typeof window.toast === 'function') {
    window.toast(TRANSLATIONS[currentLang].toastSavedAntiDetect || '✓ Saved Anti-Detect User-Agent settings!', 'success');
  }
}

export function openProxyModal() {
  const modal = document.getElementById('proxy-modal');
  const listContainer = document.getElementById('proxy-client-list');
  if (!modal || !listContainer) return;

  const profile = fullConfig.profiles[currentEditProfile];
  const aliases = profile.clientAliases || {};
  const proxies = profile.clientProxies || {};
  const trans = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  listContainer.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const alias = aliases[String(i)] || `Client ${i}`;
    const proxyVal = proxies[String(i)] || '';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';
    row.style.borderBottom = '1px dashed rgba(255,255,255,0.05)';
    row.style.paddingBottom = '10px';

    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="font-size:12px; font-weight:700; color:var(--text);">${escapeHtml(alias)}</span>
        <button type="button" class="btn btn-ghost btn-clear-proxy" data-client-idx="${i}" style="padding:2px 8px; font-size:11px; border-color:var(--border); color:var(--muted); height:24px; cursor:pointer;">✕ Clear</button>
      </div>
      <input type="text" id="proxy-input-${i}" value="${escapeHtml(proxyVal)}" placeholder="${trans.proxyInputPlaceholder || 'http://ip:port or socks5://ip:port or ip:port:user:pass'}"
        style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:6px 10px; color:var(--text); font-family:'JetBrains Mono'; font-size:11px; outline:none; width:100%; height:32px;">
    `;
    listContainer.appendChild(row);
  }

  listContainer.querySelectorAll('.btn-clear-proxy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-client-idx');
      clearProxy(idx);
    });
  });

  modal.classList.add('show');
}

export function closeProxyModal() {
  const modal = document.getElementById('proxy-modal');
  if (modal) modal.classList.remove('show');
}

export function clearProxy(idx) {
  const input = document.getElementById(`proxy-input-${idx}`);
  if (input) input.value = '';
}

export function saveProxySettings() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;
  if (!profile.clientProxies) profile.clientProxies = {};

  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`proxy-input-${i}`);
    if (input) {
      profile.clientProxies[String(i)] = input.value.trim();
    }
  }

  saveCurrentProfile();
  closeProxyModal();
  if (typeof window.toast === 'function') {
    window.toast(TRANSLATIONS[currentLang].toastSavedProxy || '✓ Saved IP / Proxy settings!', 'success');
  }
}

export function openClientSettingsModal(clientIdx) {
  const modal = document.getElementById('client-settings-modal');
  if (!modal) return;

  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  const sIdx = String(clientIdx);
  const gs = fullConfig.globalSettings || profile || {};
  const aliases = gs.clientAliases || profile.clientAliases || {};
  const userAgents = gs.clientUserAgents || profile.clientUserAgents || {};
  const proxies = gs.clientProxies || profile.clientProxies || {};

  const customAlias = aliases[sIdx] || aliases[clientIdx];
  const displayName = customAlias ? `Client ${clientIdx} (${customAlias})` : `Client ${clientIdx}`;

  const ua = userAgents[sIdx] || userAgents[clientIdx] || '';
  const proxyVal = proxies[sIdx] || proxies[clientIdx] || '';

  const titleEl = document.getElementById('client-settings-title');
  if (titleEl) titleEl.textContent = `⚙️ ${displayName} Settings`;

  const idxEl = document.getElementById('client-settings-idx');
  if (idxEl) idxEl.value = sIdx;

  const uaInput = document.getElementById('client-modal-ua-input');
  if (uaInput) uaInput.value = ua;

  const proxyInput = document.getElementById('client-modal-proxy-input');
  if (proxyInput) proxyInput.value = proxyVal;

  modal.classList.add('show');
}

export function closeClientSettingsModal() {
  const modal = document.getElementById('client-settings-modal');
  if (modal) modal.classList.remove('show');
}

export function randomizeClientModalUA() {
  const uaInput = document.getElementById('client-modal-ua-input');
  if (uaInput) {
    const rand = USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
    uaInput.value = rand;
  }
}

export function clearClientModalUA() {
  const uaInput = document.getElementById('client-modal-ua-input');
  if (uaInput) uaInput.value = '';
}

export function clearClientModalProxy() {
  const proxyInput = document.getElementById('client-modal-proxy-input');
  if (proxyInput) proxyInput.value = '';
}

export function saveClientSettingsModal() {
  const idxEl = document.getElementById('client-settings-idx');
  if (!idxEl) return;
  const sIdx = idxEl.value;

  if (!fullConfig.globalSettings) fullConfig.globalSettings = {};
  const gs = fullConfig.globalSettings;
  if (!gs.clientUserAgents) gs.clientUserAgents = {};
  if (!gs.clientProxies) gs.clientProxies = {};

  const uaInput = document.getElementById('client-modal-ua-input');
  if (uaInput) gs.clientUserAgents[sIdx] = uaInput.value.trim();

  const proxyInput = document.getElementById('client-modal-proxy-input');
  if (proxyInput) gs.clientProxies[sIdx] = proxyInput.value.trim();

  saveCurrentProfile();
  closeClientSettingsModal();

  if (typeof window.toast === 'function') {
    window.toast(`✓ Saved settings for Client ${sIdx}`, 'success');
  }
}
