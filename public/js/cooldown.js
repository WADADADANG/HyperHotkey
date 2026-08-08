import { currentLang, TRANSLATIONS, t } from './i18n.js';
import { fullConfig, currentEditProfile, saveCurrentProfile } from './state.js';

export let allCooldownPresets = {};
export let allCooldownPresetsById = {};
export let allClassIcons = {};

let activePickerActionId = null;
let activePickerClassTab = 'All';
let activeRenderActionsCb = null;

export async function fetchCooldownPresets() {
  try {
    const res = await fetch('/api/cooldown-presets');
    const data = await res.json();
    if (data.success) {
      allCooldownPresets = data.presets || {};
      allCooldownPresetsById = data.presetsById || {};
      allClassIcons = data.classIcons || {};
    }
  } catch (e) {
    console.warn("Failed to fetch cooldown presets:", e);
  }
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderCustomSkillCardContent(presetId, customMs) {
  const trans = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  if (presetId === 'custom') {
    const msText = customMs ? `${customMs}ms (${(customMs / 1000).toFixed(1)}s)` : trans.customCooldownSpecifyHint;
    return `
      <div style="width:32px; height:32px; border-radius:8px; background:rgba(168,85,247,0.2); display:flex; align-items:center; justify-content:center; font-size:16px;">⚙️</div>
      <div style="display:flex; flex-direction:column; flex:1;">
        <span style="font-size:13px; font-weight:700; color:#a855f7;">${trans.customCooldownCardTitle}</span>
        <span style="font-size:11px; color:var(--muted);">⏱️ ${msText}</span>
      </div>
      <span style="font-size:12px; color:#a855f7; font-weight:600;">${trans.changeSkillBtnText} ➔</span>
    `;
  }
  if (!presetId || !allCooldownPresetsById[presetId]) {
    return `
      <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:16px;">🚫</div>
      <div style="display:flex; flex-direction:column; flex:1;">
        <span style="font-size:13px; font-weight:600; color:var(--text);">${trans.noSkillSelectedText}</span>
        <span style="font-size:11px; color:var(--muted);">${trans.clickToSelectSkillHint}</span>
      </div>
      <span style="font-size:12px; color:var(--primary); font-weight:600;">${trans.selectSkillBtnText} ➔</span>
    `;
  }
  const item = allCooldownPresetsById[presetId];
  const effectiveMs = customMs > 0 ? customMs : (item.cooldownMs || 0);
  const isCustomOverride = customMs > 0 && customMs !== item.cooldownMs;
  const cdText = effectiveMs ? `${effectiveMs / 1000}s (${effectiveMs}ms)${isCustomOverride ? ' • Custom' : ''}` : 'No Cooldown';
  const imgHTML = item.image ? `<img src="${escapeHtml(item.image)}" style="width:32px; height:32px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.3); padding:2px; border:1px solid rgba(16,185,129,0.4);" onError="this.style.display='none'">` : `<div style="width:32px; height:32px; border-radius:6px; background:rgba(16,185,129,0.2); display:flex; align-items:center; justify-content:center;">✨</div>`;

  return `
    ${imgHTML}
    <div style="display:flex; flex-direction:column; flex:1;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:13px; font-weight:700; color:#fff;">${escapeHtml(item.name)}</span>
        <span style="font-size:10px; background:${isCustomOverride ? 'rgba(168,85,247,0.2)' : 'rgba(16,185,129,0.2)'}; border:1px solid ${isCustomOverride ? 'rgba(168,85,247,0.4)' : 'rgba(16,185,129,0.4)'}; color:${isCustomOverride ? '#a855f7' : '#10b981'}; border-radius:4px; padding:1px 6px; font-weight:700;">⏱️ ${cdText}</span>
      </div>
      <span style="font-size:11px; color:var(--muted);">${escapeHtml(item.class || 'Skill')} ${item.description ? '• ' + escapeHtml(item.description) : ''}</span>
    </div>
    <span style="font-size:12px; color:#10b981; font-weight:600;">${trans.changeSkillBtnText} ➔</span>
  `;
}

export function openSkillPickerModal(actionId, renderActionsCb) {
  activePickerActionId = actionId;
  if (renderActionsCb) activeRenderActionsCb = renderActionsCb;

  const modal = document.getElementById('skill-picker-modal');
  const searchInput = document.getElementById('skill-picker-search');
  const trans = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = trans.skillPickerSearchPlaceholder || '🔍 Search skill name or description...';
  }
  const titleEl = document.getElementById('skill-picker-modal-title');
  if (titleEl) titleEl.textContent = trans.skillPickerModalTitle || 'Select Skill Cooldown Guard';
  const clearBtn = document.getElementById('skill-picker-clear-btn');
  if (clearBtn) clearBtn.textContent = trans.skillPickerClearBtn || '🚫 None (Clear Cooldown)';
  const customBtn = document.getElementById('skill-picker-custom-btn');
  if (customBtn) customBtn.textContent = trans.skillPickerCustomBtn || '⚙️ Custom Duration';

  const profile = fullConfig.profiles[currentEditProfile];
  const act = profile ? (profile.actions || []).find(a => a.id === actionId) : null;
  if (act && act.cooldownPresetId && allCooldownPresetsById[act.cooldownPresetId]) {
    activePickerClassTab = allCooldownPresetsById[act.cooldownPresetId].class || 'All';
  } else {
    activePickerClassTab = 'All';
  }

  renderSkillPickerClassTabs();
  renderSkillPickerGrid(renderActionsCb);
  modal.classList.add('show');
}

export function closeSkillPickerModal() {
  const modal = document.getElementById('skill-picker-modal');
  if (modal) modal.classList.remove('show');
  activePickerActionId = null;
}

export function renderSkillPickerClassTabs() {
  const container = document.getElementById('skill-picker-class-tabs');
  if (!container) return;

  const classes = ['All', ...Object.keys(allCooldownPresets)];
  let html = '';

  classes.forEach(c => {
    const isSel = c === activePickerClassTab;
    const btnBg = isSel ? 'var(--primary)' : 'var(--bg-input)';
    const btnBorder = isSel ? 'var(--primary)' : 'var(--border)';
    const btnColor = isSel ? '#fff' : 'var(--muted)';

    let label = '';
    if (c === 'All') {
      label = currentLang === 'en' ? '✨ All Skills' : '✨ สกิลทั้งหมด';
    } else if (allClassIcons[c]) {
      label = `<img src="${escapeHtml(allClassIcons[c])}" style="width:16px; height:16px; object-fit:contain; border-radius:3px;" onError="this.style.display='none'"> ${escapeHtml(c)}`;
    } else {
      label = `⚔️ ${escapeHtml(c)}`;
    }

    html += `
      <button type="button" class="picker-class-tab-btn" data-class="${c}" style="background:${btnBg}; border:1px solid ${btnBorder}; color:${btnColor}; padding:4px 12px; border-radius:16px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; outline:none; display:inline-flex; align-items:center; gap:6px;">
        ${label}
      </button>
    `;
  });

  container.innerHTML = html;
  container.querySelectorAll('.picker-class-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePickerClassTab = btn.getAttribute('data-class');
      renderSkillPickerClassTabs();
      renderSkillPickerGrid();
    });
  });
}

export function renderSkillPickerGrid(renderActionsCb) {
  if (renderActionsCb) activeRenderActionsCb = renderActionsCb;
  const cb = activeRenderActionsCb;

  const container = document.getElementById('skill-picker-grid');
  const searchVal = (document.getElementById('skill-picker-search')?.value || '').toLowerCase().trim();
  if (!container) return;

  let items = [];
  if (activePickerClassTab === 'All') {
    for (const c in allCooldownPresets) {
      items.push(...(allCooldownPresets[c] || []));
    }
  } else {
    items = allCooldownPresets[activePickerClassTab] || [];
  }

  if (searchVal) {
    items = items.filter(i => 
      (i.name || '').toLowerCase().includes(searchVal) || 
      (i.description || '').toLowerCase().includes(searchVal) ||
      (i.class || '').toLowerCase().includes(searchVal)
    );
  }

  if (!items.length) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--muted); font-size:13px;">❌ ไม่พบสกิลที่ตรงกับคำค้นหา</div>`;
    return;
  }

  let html = '';
  const profile = fullConfig.profiles[currentEditProfile];
  const currentAct = profile ? (profile.actions || []).find(a => a.id === activePickerActionId) : null;
  const currentPresetId = currentAct ? currentAct.cooldownPresetId : '';

  items.forEach(item => {
    const isSelected = item.id === currentPresetId;
    const cdText = item.cooldownMs ? `${item.cooldownMs / 1000}s` : 'No Cooldown';
    const borderStyle = isSelected ? '2px solid #10b981' : '1px solid var(--border)';
    const bgStyle = isSelected ? 'rgba(16,185,129,0.1)' : 'var(--bg-input)';

    const imgTag = item.image 
      ? `<img src="${escapeHtml(item.image)}" style="width:36px; height:36px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.3); padding:2px; border:1px solid rgba(255,255,255,0.1);" onError="this.style.display='none'">`
      : `<div style="width:36px; height:36px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:16px;">✨</div>`;

    html += `
      <div class="skill-picker-card" data-preset-id="${item.id}" style="background:${bgStyle}; border:${borderStyle}; border-radius:10px; padding:10px 12px; cursor:pointer; display:flex; gap:10px; align-items:center; transition:all 0.2s;">
        ${imgTag}
        <div style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</span>
            <span style="font-size:10px; font-weight:700; color:#10b981; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:1px 5px; flex-shrink:0;">⏱️ ${cdText}</span>
          </div>
          <span style="font-size:11px; color:var(--muted); line-height:1.3; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.description || '')}">${escapeHtml(item.description || item.class || '')}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  container.querySelectorAll('.skill-picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const presetId = card.getAttribute('data-preset-id');
      selectSkillForAction(presetId, cb);
    });
  });
}

export function selectSkillForAction(presetId, renderActionsCb) {
  if (!activePickerActionId) return;
  const cb = renderActionsCb || activeRenderActionsCb;
  const profile = fullConfig.profiles[currentEditProfile];
  if (profile && profile.actions) {
    const act = profile.actions.find(a => a.id === activePickerActionId);
    if (act) act.cooldownPresetId = presetId;
  }

  const hiddenInput = document.getElementById(`cooldown-preset-input-${activePickerActionId}`);
  if (hiddenInput) hiddenInput.value = presetId;

  saveCurrentProfile();
  if (typeof cb === 'function') {
    cb(profile ? profile.actions : []);
  }
  closeSkillPickerModal();
}
