import { currentLang, TRANSLATIONS } from '../i18n.js';
import { fullConfig, currentEditProfile, activeClients, saveCurrentProfile, setRenderActionsCallback } from '../state.js';
import { allCooldownPresetsById, renderCustomSkillCardContent, openSkillPickerModal, escapeHtml } from '../cooldown.js';
import { startRecordingKey, stopRecordingKey, activeRecordingActionId } from '../key-recorder.js';

export const expandedActions = new Set();
export const expandedChains = new Set();

export function initActionsModule() {
  setRenderActionsCallback(renderActions);
}

export function normalizeMode(mode) {
  if (mode === 'action_control') return 'control';
  if (mode === 'action_condition') return 'branch';
  return mode || 'loop';
}

export function getModeDescription(mode) {
  const norm = normalizeMode(mode);
  const lang = currentLang;
  const descMap = {
    loop: TRANSLATIONS[lang]?.modeLoopDesc || '',
    buff_sequence: TRANSLATIONS[lang]?.modeBuffDesc || '',
    single_press: TRANSLATIONS[lang]?.modeSingleDesc || '',
    delay_only: TRANSLATIONS[lang]?.modeDelayOnlyDesc || '',
    forward: TRANSLATIONS[lang]?.modeForwardDesc || '',
    key_hold: TRANSLATIONS[lang]?.modeHoldDesc || '',
    control: TRANSLATIONS[lang]?.modeControlDesc || '',
    branch: TRANSLATIONS[lang]?.modeBranchDesc || ''
  };
  return descMap[norm] || '';
}

export function getModeBadgeInfo(mode) {
  const norm = normalizeMode(mode);
  const badgeMap = {
    loop: { label: 'LOOP', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)' },
    buff_sequence: { label: 'BUFF', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
    single_press: { label: 'SINGLE', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
    delay_only: { label: 'TIMER', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.35)' },
    forward: { label: 'FORWARD', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)' },
    key_hold: { label: 'HOLD', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
    control: { label: 'CONTROL', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)' },
    branch: { label: 'BRANCH', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.18)', border: 'rgba(168, 85, 247, 0.4)' }
  };
  return badgeMap[norm] || { label: (norm || '').toUpperCase(), color: 'var(--primary)', bg: 'var(--primary-dim)', border: 'rgba(99,102,241,0.2)' };
}

export function renderActions(actions) {
  const container = document.getElementById('actions-container');
  if (!container) return;
  container.innerHTML = '';

  const colors = ['var(--green)', 'var(--yellow)', 'var(--blue)', 'var(--orange)', 'var(--red)', 'var(--primary)'];

  actions.forEach((act, idx) => {
    const cardColor = colors[idx % colors.length];
    const badgeInfo = getModeBadgeInfo(act.mode);
    const card = document.createElement('div');
    card.className = 'group-card';
    card.setAttribute('data-id', act.id);
    card.style.borderLeft = `4px solid ${cardColor}`;
    card.draggable = true;

    let isDraggingFromHandle = false;
    card.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('drag-handle')) {
        isDraggingFromHandle = true;
      } else {
        isDraggingFromHandle = false;
      }
    });

    card.addEventListener('dragstart', (e) => {
      if (!isDraggingFromHandle) {
        e.preventDefault();
        return;
      }
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', act.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      const cardElements = [...container.querySelectorAll('.group-card')];
      const newOrderIds = cardElements.map(el => el.getAttribute('data-id'));
      const profileActions = fullConfig.profiles[currentEditProfile].actions;
      const sortedActions = newOrderIds.map(id => profileActions.find(a => a.id === id)).filter(Boolean);
      fullConfig.profiles[currentEditProfile].actions = sortedActions;
      saveCurrentProfile();
      renderActions(sortedActions);
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const draggingCard = container.querySelector('.dragging');
      if (!draggingCard || draggingCard === card) return;

      const rect = card.getBoundingClientRect();
      const next = (e.clientY - rect.top) > (rect.height / 2);
      container.insertBefore(draggingCard, next ? card.nextSibling : card);
    });

    const isExpanded = expandedActions.has(act.id);

    let headerHTML = `
      <div class="group-header" data-accordion-id="${act.id}" style="display:flex; justify-content:space-between; align-items:center; width:100%; gap: 12px; padding: 10px 16px; cursor:pointer; user-select:none; background:rgba(255,255,255,0.015); transition:background 0.2s;">
        <span class="drag-handle" style="cursor: grab; color: var(--muted); font-size: 14px; margin-right: 4px; user-select: none;">⋮⋮</span>
        <span class="action-arrow-${act.id}" style="font-size:10px; color:var(--muted); transition:transform 0.2s; transform:rotate(${isExpanded ? '90' : '0'}deg); width:12px; display:inline-block;">▶</span>
        <div class="group-dot" style="background:${cardColor}"></div>
        
        <input type="text" class="action-name-input" value="${escapeHtml(act.name)}" 
          placeholder="${currentLang === 'en' ? 'Action Name' : 'ชื่อคำสั่ง'}" 
          style="background:none; border:none; color:var(--text); font-size:13px; font-weight:700; outline:none; border-bottom:1px dashed rgba(255,255,255,0.15); width:160px; padding-bottom: 2px;">
        
        <div class="summary-badges" style="display:flex; align-items:center; gap:8px; font-size:11px; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--muted);">
          <span style="background:${badgeInfo.bg}; border:1px solid ${badgeInfo.border}; border-radius:4px; padding:2px 6px; color:${badgeInfo.color}; font-size:10px; font-weight:700; text-transform:uppercase;">
            ${badgeInfo.label}
          </span>
          <span>
            📍 ${act.trigger.type === 'none' ? (currentLang === 'en' ? 'Chain only' : 'Chain เท่านั้น') : `${act.trigger.type === 'keyboard' ? '⌨️' : '🖱️'} ${act.trigger.value || ''}`}
          </span>
          <span>
            🎯 จอ: ${getActionTargetsList(act.targetClient).join(', ')}
          </span>
          ${act.cooldownPresetId && allCooldownPresetsById[act.cooldownPresetId] ? `
            <span style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:2px 6px; color:#10b981; font-size:10px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              ${allCooldownPresetsById[act.cooldownPresetId].image ? `<img src="${escapeHtml(allCooldownPresetsById[act.cooldownPresetId].image)}" style="width:12px; height:12px; object-fit:contain;" onError="this.style.display='none'">` : '⏱️'}
              ${escapeHtml(allCooldownPresetsById[act.cooldownPresetId].name)} (${allCooldownPresetsById[act.cooldownPresetId].cooldownMs ? (allCooldownPresetsById[act.cooldownPresetId].cooldownMs/1000)+'s' : '0s'})
            </span>
          ` : ''}
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); cursor:pointer; font-weight:600;">
            <input type="checkbox" class="action-enabled-checkbox" ${act.enabled ? 'checked' : ''} style="accent-color:var(--primary); cursor:pointer;"> ${TRANSLATIONS[currentLang].enabled}
          </label>
          <button class="btn btn-danger btn-delete-action-card" data-action-id="${act.id}" style="padding:4px 8px; font-size:10px; border-radius:6px;">${TRANSLATIONS[currentLang].btnDeleteAction}</button>
        </div>
      </div>
    `;

    let bodyHTML = `
      <div class="group-body" style="padding:${isExpanded ? '18px 20px' : '0'}; max-height:${isExpanded ? '1500px' : '0'}; opacity:${isExpanded ? '1' : '0'}; overflow:hidden; transition: max-height 0.25s ease-out, opacity 0.2s, padding 0.25s ease-out; display:flex; flex-direction:column; gap:14px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].triggerType}</label>
            <select class="action-trigger-type" style="background:#131826; border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; cursor:pointer; outline:none;">
              <option value="keyboard" ${act.trigger.type === 'keyboard' ? 'selected' : ''}>${TRANSLATIONS[currentLang].triggerKeyboard}</option>
              <option value="mouse" ${act.trigger.type === 'mouse' ? 'selected' : ''}>${TRANSLATIONS[currentLang].triggerMouse}</option>
              <option value="none" ${(!act.trigger.type || act.trigger.type === 'none') ? 'selected' : ''}>${currentLang === 'en' ? 'None (Chain only)' : 'ไม่มี (Chain เท่านั้น)'}</option>
            </select>
          </div>
          <div class="field">
            <label>${TRANSLATIONS[currentLang].triggerHotkey}</label>
            <div class="trigger-val-container-${act.id}" style="display:flex; width:100%;">
              ${renderTriggerValField(act)}
            </div>
          </div>
        </div>

        <div class="field-row">
          <div class="field" style="${['control', 'delay_only'].includes(normalizeMode(act.mode)) ? 'grid-column: span 2;' : ''}">
            <label>${TRANSLATIONS[currentLang].actionMode}</label>
            <select class="action-mode" onchange="onModeChange('${act.id}')" style="background:#131826; border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; cursor:pointer; outline:none; width:100%;">
              <option value="loop" ${normalizeMode(act.mode) === 'loop' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeLoop}</option>
              <option value="buff_sequence" ${normalizeMode(act.mode) === 'buff_sequence' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeBuff}</option>
              <option value="single_press" ${normalizeMode(act.mode) === 'single_press' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeSingle}</option>
              <option value="delay_only" ${normalizeMode(act.mode) === 'delay_only' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeDelayOnly}</option>
              <option value="forward" ${normalizeMode(act.mode) === 'forward' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeForward}</option>
              <option value="key_hold" ${normalizeMode(act.mode) === 'key_hold' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeHold}</option>
              <option value="control" ${normalizeMode(act.mode) === 'control' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeControl}</option>
              <option value="branch" ${normalizeMode(act.mode) === 'branch' ? 'selected' : ''}>${TRANSLATIONS[currentLang].modeBranch || TRANSLATIONS[currentLang].modeCondition}</option>
            </select>
            <div class="mode-desc-hint" id="mode-desc-${act.id}" style="font-size:11px; color:var(--muted); margin-top:4px; font-style:italic;">${getModeDescription(act.mode)}</div>
          </div>
          <div class="field client-selector-container" style="display: ${['control', 'delay_only', 'branch'].includes(normalizeMode(act.mode)) ? 'none' : 'block'};">
            <label>${TRANSLATIONS[currentLang].targetClient}</label>
            ${renderTargetClientSelector(act)}
          </div>
        </div>

        <div class="field-row" style="margin-top:2px;">
          <div class="field" style="grid-column: span 2;">
            <label style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom:6px;">
              <span>⏱️ ${TRANSLATIONS[currentLang].skillCooldownGuardLabel}</span>
            </label>
            <input type="hidden" class="action-cooldown-preset" id="cooldown-preset-input-${act.id}" value="${escapeHtml(act.cooldownPresetId || '')}">
            
            <div class="custom-skill-select-card ${act.cooldownPresetId ? 'active' : ''}" 
                 data-skill-card-id="${act.id}"
                 style="background:var(--bg-input); border:1px solid ${act.cooldownPresetId === 'custom' ? '#a855f7' : (act.cooldownPresetId && allCooldownPresetsById[act.cooldownPresetId] ? '#10b981' : 'var(--border)')}; border-radius:10px; padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:all 0.2s;">
              ${renderCustomSkillCardContent(act.cooldownPresetId, act.customCooldownMs)}
            </div>

            <div class="custom-cd-input-row-${act.id}" style="display:${act.cooldownPresetId ? 'flex' : 'none'}; align-items:center; gap:10px; margin-top:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; padding:6px 12px;">
              <label style="font-size:11px; color:var(--muted); font-weight:600; white-space:nowrap;">
                ⏱️ ${TRANSLATIONS[currentLang].customCooldownMsLabel}
              </label>
              <input type="number" class="action-custom-cooldown-ms" min="0" max="600000" step="100" 
                     value="${act.customCooldownMs || ''}" 
                     placeholder="${act.cooldownPresetId && allCooldownPresetsById[act.cooldownPresetId] ? 'Preset: ' + (allCooldownPresetsById[act.cooldownPresetId].cooldownMs || 0) + 'ms' : 'e.g. 5000'}"
                     style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:4px 8px; color:var(--text); font-family:'Outfit'; font-size:12px; outline:none; flex:1;">
              <span style="font-size:11px; color:#a855f7; font-weight:bold;">${act.customCooldownMs ? ((parseInt(act.customCooldownMs)/1000).toFixed(1) + 's') : ''}</span>
            </div>
          </div>
        </div>

        <div class="mode-specific-container-${act.id}">
          ${renderModeSpecificFields(act)}
        </div>

        <div class="chain-section-container-${act.id}">
          ${renderChainSection(act)}
        </div>
      </div>
    `;

    card.innerHTML = headerHTML + bodyHTML;
    container.appendChild(card);

    // Event wiring inside card
    const headerEl = card.querySelector(`[data-accordion-id="${act.id}"]`);
    if (headerEl) {
      headerEl.addEventListener('click', (e) => {
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('label')) return;
        toggleActionAccordion(act.id);
      });
    }

    const deleteBtn = card.querySelector(`.btn-delete-action-card[data-action-id="${act.id}"]`);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAction(act.id);
      });
    }

    const skillCard = card.querySelector(`[data-skill-card-id="${act.id}"]`);
    if (skillCard) {
      skillCard.addEventListener('click', () => {
        openSkillPickerModal(act.id, renderActions);
      });
    }

    const triggerTypeSelect = card.querySelector('.action-trigger-type');
    if (triggerTypeSelect) {
      triggerTypeSelect.addEventListener('change', () => {
        onTriggerTypeChange(act.id);
      });
    }

    const modeSelect = card.querySelector('.action-mode');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        onModeChange(act.id);
      });
    }

    const nameInput = card.querySelector('.action-name-input');
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        syncActionFromDom(act.id);
        saveCurrentProfile();
      });
    }

    const enabledCheck = card.querySelector('.action-enabled-checkbox');
    if (enabledCheck) {
      enabledCheck.addEventListener('change', () => {
        syncActionFromDom(act.id);
        saveCurrentProfile();
      });
    }

    const cdInput = card.querySelector('.action-custom-cooldown-ms');
    if (cdInput) {
      cdInput.addEventListener('change', () => {
        syncActionFromDom(act.id);
        saveCurrentProfile();
        renderActions(fullConfig.profiles[currentEditProfile].actions);
      });
    }
  });
}

export function toggleActionAccordion(actionId) {
  const card = document.querySelector(`[data-id="${actionId}"]`);
  if (!card) return;
  const body = card.querySelector('.group-body');
  const arrow = card.querySelector(`.action-arrow-${actionId}`);
  if (!body) return;

  const isOpen = expandedActions.has(actionId);
  if (isOpen) {
    expandedActions.delete(actionId);
    body.style.maxHeight = '0';
    body.style.opacity = '0';
    body.style.padding = '0';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  } else {
    expandedActions.add(actionId);
    body.style.maxHeight = '1500px';
    body.style.opacity = '1';
    body.style.padding = '18px 20px';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  }
}

export function toggleChainAccordion(actionId, event) {
  if (event && event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'LABEL' || event.target.closest('label'))) {
    return;
  }
  const panel = document.querySelector(`[data-id="${actionId}"] .chain-body`);
  const arrow = document.querySelector(`[data-id="${actionId}"] .chain-arrow`);
  if (!panel) return;
  const isOpen = expandedChains.has(actionId);
  if (isOpen) {
    expandedChains.delete(actionId);
    panel.style.maxHeight = '0';
    panel.style.opacity = '0';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  } else {
    expandedChains.add(actionId);
    panel.style.maxHeight = '1000px';
    panel.style.opacity = '1';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  }
}

export function getActionTargetsList(targetClientString) {
  if (!targetClientString) return ['1'];
  if (targetClientString === 'all' || targetClientString === 'both') {
    return ['1', '2', '3', '4', '5', '6', '7', '8'];
  }
  return targetClientString.split(',').map(s => s.trim()).filter(Boolean);
}

export function renderTargetClientSelector(act) {
  const selectedTargets = getActionTargetsList(act.targetClient);
  const isAllSelected = act.targetClient === 'all' || act.targetClient === 'both';

  let html = `<div class="client-btn-group" style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">`;

  for (let i = 1; i <= 8; i++) {
    const isActive = activeClients.includes(i);
    const isSelected = isAllSelected || selectedTargets.includes(String(i));
    const activeColor = isSelected ? 'var(--primary)' : 'var(--bg-input)';
    const borderColor = isSelected ? 'var(--primary)' : 'var(--border)';
    const textColor = isSelected ? '#fff' : 'var(--muted)';
    const opacity = isActive ? '1' : '0.5';
    const titleText = isActive ? `Client ${i}` : `Client ${i} (Offline)`;

    html += `
      <button type="button" class="client-select-btn ${isSelected ? 'selected' : ''}" 
        data-action-id="${act.id}"
        data-value="${i}"
        title="${titleText}"
        onclick="toggleClientSelection(this, '${act.id}')"
        style="background:${activeColor}; border:1px solid ${borderColor}; color:${textColor}; opacity:${opacity}; width:32px; height:32px; border-radius:50%; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: all 0.2s; outline:none;">
        ${i}
      </button>
    `;
  }

  const allActiveColor = isAllSelected ? 'var(--primary)' : 'var(--bg-input)';
  const allBorderColor = isAllSelected ? 'var(--primary)' : 'var(--border)';
  const allTextColor = isAllSelected ? '#fff' : 'var(--muted)';
  html += `
    <button type="button" class="client-select-btn-all ${isAllSelected ? 'selected' : ''}"
      data-action-id="${act.id}"
      data-value="all"
      onclick="toggleClientSelection(this, '${act.id}')"
      style="background:${allActiveColor}; border:1px solid ${allBorderColor}; color:${allTextColor}; padding:0 12px; height:32px; border-radius:16px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: all 0.2s; outline:none; text-transform:uppercase;">
      ${TRANSLATIONS[currentLang].allClients || 'All'}
    </button>
  </div>`;

  html += `<input type="hidden" class="action-target-client" value="${escapeHtml(act.targetClient || '1')}">`;
  return html;
}

export function renderTriggerValField(act) {
  if (act.trigger.type === 'mouse') {
    return `
      <select class="action-trigger-val" style="background:#131826; border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; cursor:pointer; outline:none; width:100%;">
        <option value="4" ${act.trigger.value == '4' ? 'selected' : ''}>${TRANSLATIONS[currentLang].mouseButton4}</option>
        <option value="5" ${act.trigger.value == '5' ? 'selected' : ''}>${TRANSLATIONS[currentLang].mouseButton5}</option>
      </select>
    `;
  } else if (act.trigger.type === 'none') {
    const msg = currentLang === 'en' ? 'Disabled (Chain only)' : 'ใช้ไม่ได้ (ทำงานผ่าน Chain เท่านั้น)';
    return `
      <input type="text" class="action-trigger-val" value="" placeholder="${msg}" readonly disabled style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.25); border-radius:8px; padding:9px 12px; color:rgba(239, 68, 68, 0.85); font-family:'Outfit'; font-size:13px; outline:none; width:100%; cursor:not-allowed; text-align:center; font-weight:600;">
    `;
  } else {
    const placeholderText = activeRecordingActionId === act.id ? TRANSLATIONS[currentLang].pressAnyKey : TRANSLATIONS[currentLang].clickToBind;
    return `
      <div style="display:flex; align-items:center; gap:6px; width:100%;">
        <input type="text" class="action-trigger-val" value="${escapeHtml(act.trigger.value || '')}" placeholder="${placeholderText}" readonly onfocus="startRecordingKey(this, '${act.id}', 'hotkey')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer; text-align:center;">
        <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'hotkey')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
      </div>
    `;
  }
}

export function renderModeSpecificFields(act) {
  let html = '';
  if (act.mode === 'loop') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].loopKeysLabel}</label>
            <div style="display:flex; align-items:center; gap:6px; width:100%;">
              <input type="text" class="loop-keys" value="${escapeHtml((act.keys || []).join(', '))}" placeholder="${currentLang === 'en' ? 'Click to record...' : 'คลิกเพื่อบันทึก...'}" readonly onfocus="startRecordingKey(this, '${act.id}', 'comma_keys')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer;">
              <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'comma_keys')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
            </div>
          </div>
          <div class="field">
            <label>${TRANSLATIONS[currentLang].loopJitterLabel}</label>
            <input type="number" class="loop-jitter" value="${act.jitter ?? 250}" min="0" placeholder="e.g. 250" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none;">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].loopIntervalLabel}</label>
            <input type="number" class="loop-interval" id="interval-input-${act.id}" value="${act.interval ?? 3000}" min="100" step="100" oninput="syncIntervalInput('${act.id}', this.value)" onchange="saveCurrentProfile()" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none;">
          </div>
          <div class="field">
            <label>${TRANSLATIONS[currentLang].loopQuickAdjust}</label>
            <div class="range-row">
              <input type="range" id="interval-range-${act.id}" min="100" max="30000" step="100" value="${act.interval ?? 3000}" oninput="syncIntervalRange('${act.id}', this.value)" onchange="saveCurrentProfile()">
              <span class="range-val" id="interval-range-${act.id}-label">${act.interval ?? 3000}ms</span>
            </div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03); border:1px dashed var(--border); border-radius:8px; padding:10px 12px; margin-top:2px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer; font-weight:700;">
            <input type="checkbox" class="loop-execute-immediately" ${act.executeImmediately !== false ? 'checked' : ''} style="accent-color:var(--primary); cursor:pointer; width:16px; height:16px;">
            <span>${TRANSLATIONS[currentLang].loopExecuteImmediatelyLabel}</span>
          </label>
          <div style="font-size:11px; color:var(--muted); margin-left:24px; margin-top:3px; line-height:1.4;">
            ${TRANSLATIONS[currentLang].loopExecuteImmediatelyHint}
          </div>
        </div>

        <div class="field" style="margin-top:4px;">
          <label>${TRANSLATIONS[currentLang].firstStepsLabel}</label>
          <div class="dyn-list" id="first-steps-list-${act.id}">
            ${renderFirstStepsForAction(act)}
          </div>
          <div class="add-row" style="margin-top:6px;">
            <button type="button" class="btn btn-ghost btn-add-first-step" onclick="addFirstStepToAction('${act.id}')" style="padding:4px 10px; font-size:11px; border-radius:6px;">${TRANSLATIONS[currentLang].btnAddStep}</button>
          </div>
        </div>

        <div class="field-row" style="margin-top:4px;">
          <div class="field" style="max-width:240px;">
            <label>${currentLang === 'en' ? 'Delay After Loop Stop (ms)' : 'หน่วงเวลาหลังหยุดลูป (มิลลิวินาที)'}</label>
            <input type="number" class="loop-delay-after" value="${act.delayAfter ?? 0}" min="0" placeholder="e.g. 500" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
        </div>
      </div>
    `;
  } else if (act.mode === 'buff_sequence') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].buffDelayLabel}</label>
            <input type="number" class="buff-delay" value="${act.delayBuff ?? 800}" min="50" step="50" placeholder="800" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
          <div class="field">
            <label>${currentLang === 'en' ? 'Delay After Sequence (ms)' : 'หน่วงเวลาหลังจบชุด (มิลลิวินาที)'}</label>
            <input type="number" class="buff-delay-after" value="${act.delayAfter ?? 0}" min="0" placeholder="e.g. 500" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
        </div>
        <div class="field">
          <label>${TRANSLATIONS[currentLang].buffKeysLabel}</label>
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <input type="text" class="buff-keys" value="${escapeHtml((act.keys || []).join(', '))}" placeholder="${currentLang === 'en' ? 'Click to record...' : 'คลิกเพื่อบันทึก...'}" readonly onfocus="startRecordingKey(this, '${act.id}', 'comma_keys')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer;">
            <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'comma_keys')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
          </div>
        </div>
      </div>
    `;
  } else if (act.mode === 'single_press') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].singleKeysLabel}</label>
            <div style="display:flex; align-items:center; gap:6px; width:100%;">
              <input type="text" class="single-keys" value="${escapeHtml((act.keys || []).join(', '))}" placeholder="${currentLang === 'en' ? 'Click to record...' : 'คลิกเพื่อบันทึก...'}" readonly onfocus="startRecordingKey(this, '${act.id}', 'single_key')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer;">
              <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'single_key')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
            </div>
          </div>
          <div class="field">
            <label>${currentLang === 'en' ? 'Delay After Single Press (ms)' : 'หน่วงเวลาหลังกด (มิลลิวินาที)'}</label>
            <input type="number" class="single-delay-after" value="${act.delayAfter ?? 0}" min="0" placeholder="e.g. 500" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
        </div>
      </div>
    `;
  } else if (act.mode === 'delay_only') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field">
          <label style="color:var(--primary); font-weight:700;">⏱️ ${TRANSLATIONS[currentLang].delayOnlyLabel || 'Delay Duration (ms)'}</label>
          <input type="number" class="delay-only-ms" value="${act.delayMs ?? 1000}" min="50" step="50" placeholder="1000" style="background:var(--bg-input); border:1px solid var(--border-focus); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          <span style="font-size:11px; color:var(--muted); margin-top:4px;">${TRANSLATIONS[currentLang].delayOnlyHint || 'Pure waiting time before triggering chained actions'}</span>
        </div>
      </div>
    `;
  } else if (act.mode === 'forward') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].forwardTargetKeyLabel}</label>
            <div style="display:flex; align-items:center; gap:6px; width:100%;">
              <input type="text" class="forward-target-key" value="${escapeHtml(act.targetKey || '5')}" placeholder="e.g. 5 or F1" readonly onfocus="startRecordingKey(this, '${act.id}', 'single_key')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer;">
              <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'single_key')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
            </div>
          </div>
          <div class="field">
            <label>${currentLang === 'en' ? 'Delay After Key Up (ms)' : 'หน่วงเวลาหลังปล่อยปุ่ม (มิลลิวินาที)'}</label>
            <input type="number" class="forward-delay-after" value="${act.delayAfter ?? 0}" min="0" placeholder="e.g. 500" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03); border:1px dashed var(--border); border-radius:8px; padding:10px 12px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer; font-weight:700;">
            <input type="checkbox" class="forward-delay-activation" ${act.delayActivation ? 'checked' : ''} style="accent-color:var(--primary); cursor:pointer; width:16px; height:16px;">
            <span>${TRANSLATIONS[currentLang].forwardDelayActivationLabel}</span>
          </label>
          <div class="forward-delay-activation-field-${act.id}" style="display:${act.delayActivation ? 'flex' : 'none'}; flex-direction:column; gap:6px; margin-top:10px; margin-left:24px;">
            <label style="font-size:11px; color:var(--muted); font-weight:600;">${TRANSLATIONS[currentLang].forwardActivationDelayMsLabel}</label>
            <input type="number" class="forward-activation-delay-ms" value="${act.activationDelayMs ?? 1000}" min="100" step="100" placeholder="1000" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text); font-family:'JetBrains Mono'; font-size:12px; outline:none; width:180px;">
          </div>
        </div>
      </div>
    `;
  } else if (act.mode === 'key_hold') {
    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].holdTargetKeyLabel}</label>
            <div style="display:flex; align-items:center; gap:6px; width:100%;">
              <input type="text" class="hold-target-key" value="${escapeHtml(act.targetKey || '1')}" placeholder="e.g. 1 or F2" readonly onfocus="startRecordingKey(this, '${act.id}', 'single_key')" onblur="stopRecordingKey(this)" style="flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; cursor:pointer;">
              <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'single_key')" style="height:38px; padding:0 10px; border-color:var(--primary); color:var(--primary); border-radius:8px;" title="Open Virtual Keyboard Picker">⌨️</button>
            </div>
          </div>
          <div class="field">
            <label>${currentLang === 'en' ? 'Delay After Toggle (ms)' : 'หน่วงเวลาหลังสลับเปิด/ปิด (มิลลิวินาที)'}</label>
            <input type="number" class="hold-delay-after" value="${act.delayAfter ?? 0}" min="0" placeholder="e.g. 500" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'JetBrains Mono'; font-size:13px; outline:none; width:100%;">
          </div>
        </div>
      </div>
    `;
  } else if (normalizeMode(act.mode) === 'control') {
    const otherActions = (fullConfig.profiles[currentEditProfile].actions || []).filter(a => a.id !== act.id);
    const selectedTargetIds = act.controlTargetIds || (act.controlTargetId ? [act.controlTargetId] : []);
    const op = act.controlOperation || 'toggle';

    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].controlTargetLabel || 'Target Action to Control'}</label>
            <div class="control-target-box" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:4px; height:170px; overflow-y:auto; width:100%; display:flex; flex-direction:column; gap:3px;">
              ${otherActions.length === 0 ? `
                <span style="font-size:10px; color:var(--muted); font-style:italic; padding:4px;">No other actions</span>
              ` : otherActions.map(a => {
                const isSel = selectedTargetIds.includes(a.id);
                return `
                  <div class="control-option-item ${isSel ? 'selected' : ''}" data-value="${a.id}" onclick="toggleControlTargetItem('${act.id}', '${a.id}', this)"
                    style="padding:5px 8px; border-radius:6px; font-size:12px; cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between; transition:all 0.15s ease; ${isSel ? 'background:rgba(59,130,246,0.25); color:#f8fafc; font-weight:700; border:1px solid rgba(59,130,246,0.5);' : 'color:var(--text); border:1px solid transparent;'}">
                    <span>${escapeHtml(a.name)} <span style="font-size:10px; color:var(--muted); font-weight:400;">(${normalizeMode(a.mode)})</span></span>
                    <span class="check-badge" style="font-size:11px; color:#3b82f6; font-weight:700;">${isSel ? '✓' : ''}</span>
                  </div>`;
              }).join('')}
            </div>
            <span style="font-size:10px; color:var(--muted); margin-top:3px;">${currentLang === 'en' ? 'Click to select/unselect target actions' : 'คลิกเพื่อเลือก/ยกเลิก Action เป้าหมาย'}</span>
          </div>
          <div class="field">
            <label>${TRANSLATIONS[currentLang].controlOperationLabel || 'Operation to Perform'}</label>
            <select class="control-operation" onchange="onControlOperationChange('${act.id}')" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; outline:none; width:100%;">
              <option value="toggle" ${op === 'toggle' ? 'selected' : ''}>${TRANSLATIONS[currentLang].controlOpToggle || '🔄 Toggle'}</option>
              <option value="start" ${op === 'start' ? 'selected' : ''}>${TRANSLATIONS[currentLang].controlOpStart || '🟢 Start'}</option>
              <option value="stop" ${op === 'stop' ? 'selected' : ''}>${TRANSLATIONS[currentLang].controlOpStop || '🔴 Stop'}</option>
            </select>
          </div>
        </div>
      </div>
    `;
  } else if (normalizeMode(act.mode) === 'branch') {
    const statefulModes = ['loop', 'buff_sequence', 'key_hold'];
    const checkableActions = (fullConfig.profiles[currentEditProfile].actions || []).filter(a => a.id !== act.id && statefulModes.includes(normalizeMode(a.mode)));
    const targetId = act.conditionTargetId || '';
    const rule = act.conditionRule || 'is_running';

    html = `
      <div style="display:flex; flex-direction:column; gap:12px; border-top:1px dashed var(--border); padding-top:12px;">
        <div class="field-row">
          <div class="field">
            <label>${TRANSLATIONS[currentLang].conditionTargetLabel || 'Target Action to Check'}</label>
            <select class="condition-target-id" onchange="syncActionFromDom('${act.id}'); saveCurrentProfile();" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; outline:none; width:100%;">
              <option value="">${currentLang === 'en' ? '-- Select Action to Check --' : '-- เลือก Action อ้างอิง --'}</option>
              ${checkableActions.length === 0 ? `
                <option value="" disabled>${currentLang === 'en' ? '(No checkable active actions available)' : '(ไม่มี Action ที่มีสถานะให้เช็ค)'}</option>
              ` : checkableActions.map(a => `<option value="${a.id}" ${a.id === targetId ? 'selected' : ''}>${escapeHtml(a.name)} (${a.mode})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>${TRANSLATIONS[currentLang].conditionRuleLabel || 'Condition Evaluation Rule'}</label>
            <select class="condition-rule" onchange="syncActionFromDom('${act.id}'); saveCurrentProfile();" style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:'Outfit'; font-size:13px; outline:none; width:100%;">
              <option value="is_running" ${rule === 'is_running' ? 'selected' : ''}>${TRANSLATIONS[currentLang].ruleIsRunning || '🟢 Is Running (Active)'}</option>
              <option value="is_stopped" ${rule === 'is_stopped' ? 'selected' : ''}>${TRANSLATIONS[currentLang].ruleIsStopped || '🔴 Is Stopped (Inactive)'}</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }
  return html;
}

export function toggleControlTargetItem(actionId, targetId, itemEl) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;
  const act = profile.actions.find(a => a.id === actionId);
  if (!act) return;

  if (!act.controlTargetIds) {
    act.controlTargetIds = act.controlTargetId ? [act.controlTargetId] : [];
  }
  delete act.controlTargetId;

  const arr = act.controlTargetIds;
  const idx = arr.indexOf(targetId);

  if (idx > -1) {
    arr.splice(idx, 1);
  } else {
    arr.push(targetId);
  }

  const isSel = arr.includes(targetId);
  if (itemEl) {
    itemEl.style.background = isSel ? 'rgba(59,130,246,0.25)' : 'transparent';
    itemEl.style.color = isSel ? '#f8fafc' : 'var(--text)';
    itemEl.style.fontWeight = isSel ? '700' : '400';
    itemEl.style.border = isSel ? '1px solid rgba(59,130,246,0.5)' : '1px solid transparent';
    const checkBadge = itemEl.querySelector('.check-badge');
    if (checkBadge) checkBadge.textContent = isSel ? '✓' : '';
  }

  saveCurrentProfile();
}

export function onControlOperationChange(actionId) {
  syncActionFromDom(actionId);
  saveCurrentProfile();
}

export function renderChainSection(act) {
  const events = getChainEventsForMode(act.mode, act);
  if (!events.length) return '';

  const chains = act.chaining || {};
  const chainedCount = events.reduce((n, ev) => n + (chains[ev] || []).length, 0);
  const otherActions = fullConfig.profiles[currentEditProfile].actions || [];

  let rows = events.map(ev => {
    const selected = (chains[ev] || []);
    return `
      <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:140px;">
        <span style="font-size:11px; color:#a855f7; font-family:'JetBrains Mono'; font-weight:700;">${ev}</span>
        <div class="chain-target-box" data-event="${ev}" style="background:var(--bg-input); border:1px solid rgba(168,85,247,0.3); border-radius:6px; padding:4px; height:170px; overflow-y:auto; width:100%; display:flex; flex-direction:column; gap:3px;">
          ${otherActions.filter(a => a.id !== act.id).length === 0 ? `
            <span style="font-size:10px; color:var(--muted); font-style:italic; padding:4px;">No other actions</span>
          ` : otherActions.filter(a => a.id !== act.id).map(a => {
            const isSel = selected.includes(a.id);
            return `
              <div class="chain-option-item ${isSel ? 'selected' : ''}" data-value="${a.id}" onclick="toggleChainItem('${act.id}', '${ev}', '${a.id}', this)"
                style="padding:3px 6px; border-radius:4px; font-size:11px; cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between; transition:all 0.15s ease; ${isSel ? 'background:rgba(168,85,247,0.3); color:#f8fafc; font-weight:700; border:1px solid rgba(168,85,247,0.5);' : 'color:var(--muted); border:1px solid transparent;'}">
                <span>${escapeHtml(a.name)}</span>
                <span class="check-badge" style="font-size:11px; color:#a855f7; font-weight:700;">${isSel ? '✓' : ''}</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  const chainEnabled = act.chaining?._enabled === true;
  const isExpanded = expandedChains.has(act.id);
  const badgeHtml = `<span class="chain-badge" style="background:rgba(168,85,247,0.2); color:#a855f7; border-radius:10px; padding:1px 7px; font-size:10px; font-weight:700; ${chainedCount > 0 ? '' : 'display:none;'}">${chainedCount}</span>`;

  return `
    <div style="border-top:1px dashed rgba(168,85,247,0.25); margin-top:12px; padding-top:10px;">
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;" onclick="toggleChainAccordion('${act.id}', event)">
        <span class="chain-arrow" style="font-size:12px; color:#a855f7; transition:transform 0.2s; transform:rotate(${isExpanded ? '90' : '0'}deg);">▶</span>
        <span style="font-size:11px; color:#a855f7; font-weight:700; letter-spacing:0.5px;">⛓ ACTION CHAIN</span>
        ${badgeHtml}
        <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted); cursor:pointer; margin-left:auto;" onclick="event.stopPropagation()">
          <input type="checkbox" class="chain-enabled" ${chainEnabled ? 'checked' : ''} style="accent-color:#a855f7; cursor:pointer;" onchange="onChainEnabledToggle('${act.id}', this)">
          ${currentLang === 'en' ? 'Enabled' : 'เปิดใช้'}
        </label>
      </div>
      <div class="chain-body" style="overflow:hidden; transition:max-height 0.25s ease, opacity 0.2s; max-height:${isExpanded ? '800px' : '0'}; opacity:${isExpanded ? '1' : '0'};">
        <div style="padding-top:10px;">
          <div style="font-size:10px; color:var(--muted); margin-bottom:8px;">เลือก Action ที่จะ Trigger อัตโนมัติเมื่อเกิด event (คลิกเพื่อเลือก/ยกเลิก)</div>
          <div class="chain-rows" style="display:flex; gap:12px; flex-wrap:wrap; opacity:${chainEnabled ? '1' : '0.35'}; pointer-events:${chainEnabled ? '' : 'none'}; transition:opacity 0.2s;">
            ${rows}
          </div>
        </div>
      </div>
    </div>`;
}

export function toggleChainItem(actionId, eventName, targetId, itemEl) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;
  const act = profile.actions.find(a => a.id === actionId);
  if (!act) return;

  if (!act.chaining) act.chaining = {};
  if (!act.chaining[eventName]) act.chaining[eventName] = [];

  const arr = act.chaining[eventName];
  const idx = arr.indexOf(targetId);

  if (idx > -1) {
    arr.splice(idx, 1);
  } else {
    arr.push(targetId);
  }

  const isSel = arr.includes(targetId);
  if (itemEl) {
    itemEl.style.background = isSel ? 'rgba(168,85,247,0.3)' : 'transparent';
    itemEl.style.color = isSel ? '#f8fafc' : 'var(--muted)';
    itemEl.style.fontWeight = isSel ? '700' : '400';
    itemEl.style.border = isSel ? '1px solid rgba(168,85,247,0.5)' : '1px solid transparent';
    const checkBadge = itemEl.querySelector('.check-badge');
    if (checkBadge) checkBadge.textContent = isSel ? '✓' : '';
  }

  const card = document.querySelector(`[data-id="${actionId}"]`);
  if (card) {
    const events = getChainEventsForMode(act.mode, act);
    const chainedCount = events.reduce((n, ev) => n + (act.chaining[ev] || []).length, 0);
    const badgeEl = card.querySelector('.chain-badge');
    if (badgeEl) {
      if (chainedCount > 0) {
        badgeEl.textContent = chainedCount;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  }

  saveCurrentProfile();
}

export function onChainEnabledToggle(actionId, checkbox) {
  const card = document.querySelector(`[data-id="${actionId}"]`);
  if (!card) return;
  const chainRows = card.querySelector('.chain-rows');
  if (chainRows) {
    const isChecked = checkbox.checked;
    chainRows.style.opacity = isChecked ? '1' : '0.35';
    chainRows.style.pointerEvents = isChecked ? '' : 'none';
  }
  syncActionFromDom(actionId);
  saveCurrentProfile();
}

function getChainEventsForMode(mode, act) {
  const norm = normalizeMode(mode);
  const map = {
    loop: ['onBeforeStart', 'onAfterStart', 'onEachCycle', 'onStop'],
    buff_sequence: ['onBeforeStart', 'onAfterStart', 'onComplete'],
    single_press: ['onFired'],
    delay_only: ['onBeforeStart', 'onComplete'],
    forward: ['onKeyDown', 'onActivated', 'onKeyUp'],
    key_hold: ['onEnable', 'onDisable'],
    branch: ['onTrue', 'onFalse']
  };
  return map[norm] || [];
}

export function renderFirstStepsForAction(act) {
  const steps = act.firstSteps || [];
  if (steps.length === 0) return '';
  return steps.map((step, idx) => `
    <div class="dyn-item" data-step-idx="${idx}">
      <div class="field">
        <label>${TRANSLATIONS[currentLang].stepKeyLabel}</label>
        <div style="display:flex; align-items:center; gap:4px; width:100%;">
          <input type="text" class="step-key" value="${escapeHtml(step.key || '')}" placeholder="1" readonly onfocus="startRecordingKey(this, '${act.id}', 'step_${idx}')" onblur="stopRecordingKey(this)" style="cursor:pointer; flex:1; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:12px; color:var(--text); font-family:'JetBrains Mono';">
          <button type="button" class="btn btn-ghost" onclick="openVirtualKeyboard(this.previousElementSibling, '${act.id}', 'step_${idx}')" style="height:28px; padding:0 6px; font-size:11px; border-color:var(--primary); color:var(--primary); border-radius:6px;" title="Open Virtual Keyboard Picker">⌨️</button>
        </div>
      </div>
      <div class="field">
        <label>${TRANSLATIONS[currentLang].stepDelayLabel}</label>
        <input type="number" class="step-delay" value="${step.delay !== undefined ? step.delay : 500}" min="0" step="50" onchange="syncActionFromDom('${act.id}'); saveCurrentProfile();" style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:12px; color:var(--text); font-family:'JetBrains Mono';">
      </div>
      <button type="button" class="del-btn btn-del-step" onclick="removeFirstStepFromAction('${act.id}', ${idx})" title="Delete Step">✕</button>
    </div>
  `).join('');
}

export function addNewAction() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  const newId = 'act_' + Date.now();
  const newAction = {
    id: newId,
    name: 'Action ' + ((profile.actions || []).length + 1),
    enabled: true,
    trigger: { type: 'keyboard', value: '' },
    mode: 'loop',
    targetClient: '1',
    keys: ['1'],
    interval: 3000,
    jitter: 250,
    executeImmediately: true,
    firstSteps: []
  };

  profile.actions.push(newAction);
  expandedActions.add(newId);
  saveCurrentProfile();
  renderActions(profile.actions);
  if (typeof window.toast === 'function') {
    window.toast(TRANSLATIONS[currentLang].toastAddedAction || 'Added action', 'success');
  }
}

export function deleteAction(actionId) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;
  profile.actions = (profile.actions || []).filter(a => a.id !== actionId);
  expandedActions.delete(actionId);
  expandedChains.delete(actionId);
  saveCurrentProfile();
  renderActions(profile.actions);
  if (typeof window.toast === 'function') {
    window.toast(TRANSLATIONS[currentLang].toastDeletedAction || 'Deleted action', 'info');
  }
}

export function onTriggerTypeChange(actionId) {
  syncActionFromDom(actionId);
  saveCurrentProfile();
  renderActions(fullConfig.profiles[currentEditProfile].actions);
}

export function onModeChange(actionId) {
  syncActionFromDom(actionId);
  saveCurrentProfile();
  renderActions(fullConfig.profiles[currentEditProfile].actions);
}

export function syncActionFromDom(actionId) {
  const card = document.querySelector(`[data-id="${actionId}"]`);
  if (!card) return;

  const act = fullConfig.profiles[currentEditProfile].actions.find(a => a.id === actionId);
  if (!act) return;

  const nameEl = card.querySelector('.action-name-input');
  if (nameEl) act.name = nameEl.value.trim();

  const enabledEl = card.querySelector('.action-enabled-checkbox');
  if (enabledEl) act.enabled = !!enabledEl.checked;

  const triggerTypeEl = card.querySelector('.action-trigger-type');
  const triggerValEl = card.querySelector('.action-trigger-val');
  if (triggerTypeEl) {
    act.trigger.type = triggerTypeEl.value;
    if (triggerValEl) act.trigger.value = triggerValEl.value;
  }

  const modeEl = card.querySelector('.action-mode');
  if (modeEl) act.mode = modeEl.value;

  const targetClientEl = card.querySelector('.action-target-client');
  if (targetClientEl) act.targetClient = targetClientEl.value;

  const cdPresetEl = card.querySelector('.action-cooldown-preset');
  if (cdPresetEl) act.cooldownPresetId = cdPresetEl.value;

  const customCdEl = card.querySelector('.action-custom-cooldown-ms');
  if (customCdEl) act.customCooldownMs = parseInt(customCdEl.value) || 0;

  if (act.mode === 'loop') {
    const keysEl = card.querySelector('.loop-keys');
    if (keysEl) act.keys = keysEl.value.split(',').map(s => s.trim()).filter(Boolean);

    const jitterEl = card.querySelector('.loop-jitter');
    if (jitterEl) act.jitter = parseInt(jitterEl.value) || 0;

    const intervalEl = card.querySelector('.loop-interval');
    if (intervalEl) act.interval = parseInt(intervalEl.value) || 3000;

    const immEl = card.querySelector('.loop-execute-immediately');
    if (immEl) act.executeImmediately = !!immEl.checked;

    const delayAfterEl = card.querySelector('.loop-delay-after');
    if (delayAfterEl) act.delayAfter = parseInt(delayAfterEl.value) || 0;

    const stepEls = card.querySelectorAll('.dyn-item');
    if (stepEls.length > 0) {
      act.firstSteps = Array.from(stepEls).map(el => {
        const rawDelay = parseInt(el.querySelector('.step-delay')?.value, 10);
        return {
          key: el.querySelector('.step-key')?.value.trim() || '',
          delay: isNaN(rawDelay) ? 0 : Math.max(0, rawDelay)
        };
      });
    } else {
      act.firstSteps = [];
    }
  } else if (act.mode === 'buff_sequence') {
    const keysEl = card.querySelector('.buff-keys');
    if (keysEl) act.keys = keysEl.value.split(',').map(s => s.trim()).filter(Boolean);

    const delayEl = card.querySelector('.buff-delay');
    if (delayEl) act.delayBuff = parseInt(delayEl.value) || 800;

    const delayAfterEl = card.querySelector('.buff-delay-after');
    if (delayAfterEl) act.delayAfter = parseInt(delayAfterEl.value) || 0;
  } else if (act.mode === 'single_press') {
    const keysEl = card.querySelector('.single-keys');
    if (keysEl) act.keys = keysEl.value.split(',').map(s => s.trim()).filter(Boolean);

    const delayAfterEl = card.querySelector('.single-delay-after');
    if (delayAfterEl) act.delayAfter = parseInt(delayAfterEl.value) || 0;
  } else if (act.mode === 'delay_only') {
    const delayMsEl = card.querySelector('.delay-only-ms');
    if (delayMsEl) act.delayMs = parseInt(delayMsEl.value) || 1000;
  } else if (act.mode === 'forward') {
    const targetKeyEl = card.querySelector('.forward-target-key');
    if (targetKeyEl) act.targetKey = targetKeyEl.value.trim();

    const delayActEl = card.querySelector('.forward-delay-activation');
    if (delayActEl) act.delayActivation = !!delayActEl.checked;

    const actDelayMsEl = card.querySelector('.forward-activation-delay-ms');
    if (actDelayMsEl) act.activationDelayMs = parseInt(actDelayMsEl.value) || 1000;

    const delayAfterEl = card.querySelector('.forward-delay-after');
    if (delayAfterEl) act.delayAfter = parseInt(delayAfterEl.value) || 0;
  } else if (act.mode === 'key_hold') {
    const targetKeyEl = card.querySelector('.hold-target-key');
    if (targetKeyEl) act.targetKey = targetKeyEl.value.trim();

    const delayAfterEl = card.querySelector('.hold-delay-after');
    if (delayAfterEl) act.delayAfter = parseInt(delayAfterEl.value) || 0;
  } else if (normalizeMode(act.mode) === 'control') {
    const targetIdsEl = card.querySelector('.control-target-ids');
    if (targetIdsEl) {
      const selected = Array.from(targetIdsEl.selectedOptions).map(o => o.value);
      act.controlTargetIds = selected;
      delete act.controlTargetId;
    }
    const opEl = card.querySelector('.control-operation');
    if (opEl) act.controlOperation = opEl.value;
  } else if (normalizeMode(act.mode) === 'branch') {
    const targetEl = card.querySelector('.condition-target-id');
    if (targetEl) act.conditionTargetId = targetEl.value;

    const ruleEl = card.querySelector('.condition-rule');
    if (ruleEl) act.conditionRule = ruleEl.value;
  }

  const chainEnabledEl = card.querySelector('.chain-enabled');
  if (chainEnabledEl) {
    if (!act.chaining) act.chaining = {};
    act.chaining._enabled = !!chainEnabledEl.checked;

    const chainSelects = card.querySelectorAll('.chain-target');
    chainSelects.forEach(select => {
      const ev = select.getAttribute('data-event');
      const selected = Array.from(select.selectedOptions).map(o => o.value);
      act.chaining[ev] = selected;
    });
  }
}

export function toggleClientSelection(btn, actionId) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;
  const act = profile.actions.find(a => a.id === actionId);
  if (!act) return;

  const val = btn.getAttribute('data-value');
  let currentVal = act.targetClient || '1';

  let targets = [];
  if (currentVal === 'all' || currentVal === 'both') {
    targets = ['1', '2', '3', '4', '5', '6', '7', '8'];
  } else {
    targets = currentVal.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (val === 'all') {
    if (btn.classList.contains('selected')) {
      act.targetClient = '1';
    } else {
      act.targetClient = 'all';
    }
  } else {
    if (targets.includes(val)) {
      targets = targets.filter(t => t !== val);
    } else {
      targets.push(val);
    }

    targets.sort((a, b) => parseInt(a) - parseInt(b));

    if (targets.length === 0) {
      act.targetClient = '1';
    } else if (targets.length === 8) {
      act.targetClient = 'all';
    } else {
      act.targetClient = targets.join(',');
    }
  }

  const card = document.querySelector(`[data-id="${actionId}"]`);
  if (card) {
    const hiddenInput = card.querySelector('.action-target-client');
    if (hiddenInput) hiddenInput.value = act.targetClient;
  }

  saveCurrentProfile();
  renderActions(profile.actions);
}

export function toggleForwardDelayDisplay(actionId, isChecked) {
  const container = document.querySelector(`.forward-delay-ms-container-${actionId}`);
  if (container) {
    container.style.display = isChecked ? 'flex' : 'none';
  }
}

export function addFirstStepToAction(actionId) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;
  const act = profile.actions.find(a => a.id === actionId);
  if (!act) return;

  syncActionFromDom(actionId);

  if (!act.firstSteps) act.firstSteps = [];
  act.firstSteps.push({ key: '', delay: 500 });

  const listEl = document.getElementById(`first-steps-list-${actionId}`);
  if (listEl) {
    listEl.innerHTML = renderFirstStepsForAction(act);
  } else {
    renderActions(profile.actions);
  }

  saveCurrentProfile();
}

export function removeFirstStepFromAction(actionId, stepIdx) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;
  const act = profile.actions.find(a => a.id === actionId);
  if (!act) return;

  syncActionFromDom(actionId);

  if (act.firstSteps && Array.isArray(act.firstSteps)) {
    act.firstSteps.splice(stepIdx, 1);
  }

  const listEl = document.getElementById(`first-steps-list-${actionId}`);
  if (listEl) {
    listEl.innerHTML = renderFirstStepsForAction(act);
  } else {
    renderActions(profile.actions);
  }

  saveCurrentProfile();
}

export function syncIntervalRange(actionId, value) {
  const numInput = document.getElementById(`interval-input-${actionId}`);
  const label = document.getElementById(`interval-range-${actionId}-label`);
  if (numInput) numInput.value = value;
  if (label) label.textContent = `${value}ms`;
  const profile = fullConfig.profiles[currentEditProfile];
  if (profile && profile.actions) {
    const act = profile.actions.find(a => a.id === actionId);
    if (act) act.interval = parseInt(value, 10) || 100;
  }
}

export function syncIntervalInput(actionId, value) {
  const rangeInput = document.getElementById(`interval-range-${actionId}`);
  const label = document.getElementById(`interval-range-${actionId}-label`);
  if (rangeInput) rangeInput.value = value;
  if (label) label.textContent = `${value}ms`;
  const profile = fullConfig.profiles[currentEditProfile];
  if (profile && profile.actions) {
    const act = profile.actions.find(a => a.id === actionId);
    if (act) act.interval = parseInt(value, 10) || 100;
  }
}
