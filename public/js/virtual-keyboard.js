import { currentLang, TRANSLATIONS } from './i18n.js';
import { fullConfig, currentEditProfile, saveCurrentProfile } from './state.js';
import { syncActionFromDom, renderActions } from './components/actions.js';

let targetInput = null;
let targetActionId = null;
let targetType = null; // 'hotkey', 'single_key', 'comma_keys', 'suspend_hotkey'

let selectedModifiers = new Set();
let selectedKeys = [];
let isManualMode = false;

export function openVirtualKeyboard(input, actionId = null, type = 'hotkey') {
  targetInput = input;
  targetActionId = actionId;
  targetType = type;
  selectedModifiers.clear();
  selectedKeys = [];
  isManualMode = false;

  const existingVal = input ? input.value.trim() : '';
  if (existingVal) {
    if (targetType === 'comma_keys') {
      selectedKeys = existingVal.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const parts = existingVal.split('+').map(s => s.trim()).filter(Boolean);
      parts.forEach(part => {
        const upper = part.toUpperCase();
        if (['LEFT ALT', 'RIGHT ALT', 'ALT', 'LEFT CTRL', 'RIGHT CTRL', 'CTRL', 'LEFT SHIFT', 'RIGHT SHIFT', 'SHIFT'].includes(upper)) {
          selectedModifiers.add(upper === 'ALT' ? 'LEFT ALT' : (upper === 'CTRL' ? 'CTRL' : (upper === 'SHIFT' ? 'SHIFT' : upper)));
        } else {
          selectedKeys.push(part);
        }
      });
    }
  }

  renderKeyboardUI();

  const modal = document.getElementById('virtual-keyboard-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

export function closeVirtualKeyboard() {
  const modal = document.getElementById('virtual-keyboard-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  targetInput = null;
  targetActionId = null;
  targetType = null;
}

export function toggleModifier(modName) {
  if (selectedModifiers.has(modName)) {
    selectedModifiers.delete(modName);
  } else {
    selectedModifiers.add(modName);
  }
  updatePreviewDisplay();
  renderModifierButtonsState();
}

export function pressVirtualKey(keyName) {
  if (targetType === 'comma_keys') {
    if (selectedModifiers.size > 0) {
      const combo = `${Array.from(selectedModifiers).join(' + ')} + ${keyName}`;
      selectedKeys.push(combo);
      selectedModifiers.clear();
      renderModifierButtonsState();
    } else {
      selectedKeys.push(keyName);
    }
  } else {
    selectedKeys = [keyName];
  }
  updatePreviewDisplay();
}

export function clearVirtualKeyboard() {
  selectedModifiers.clear();
  selectedKeys = [];
  const manualInput = document.getElementById('vk-manual-input');
  if (manualInput) manualInput.value = '';
  updatePreviewDisplay();
  renderModifierButtonsState();
}

export function popVirtualKey() {
  if (selectedKeys.length > 0) {
    selectedKeys.pop();
  } else if (selectedModifiers.size > 0) {
    const lastMod = Array.from(selectedModifiers).pop();
    selectedModifiers.delete(lastMod);
    renderModifierButtonsState();
  }
  updatePreviewDisplay();
}

export function toggleManualMode() {
  isManualMode = !isManualMode;
  const pickerArea = document.getElementById('vk-picker-area');
  const manualArea = document.getElementById('vk-manual-area');
  const toggleBtn = document.getElementById('vk-toggle-manual-btn');

  if (isManualMode) {
    if (pickerArea) pickerArea.style.display = 'none';
    if (manualArea) manualArea.style.display = 'flex';
    if (toggleBtn) toggleBtn.textContent = '⌨️ Switch to Key Picker';
    const manualInput = document.getElementById('vk-manual-input');
    if (manualInput) {
      manualInput.value = buildFinalString();
      manualInput.focus();
    }
  } else {
    if (pickerArea) pickerArea.style.display = 'flex';
    if (manualArea) manualArea.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '✏️ Switch to Manual Typing';
  }
}

export function applyVirtualKeyboard() {
  let finalVal = '';
  if (isManualMode) {
    const manualInput = document.getElementById('vk-manual-input');
    finalVal = manualInput ? manualInput.value.trim() : '';
  } else {
    finalVal = buildFinalString();
  }

  if (targetInput) {
    targetInput.value = finalVal;
  }

  if (targetType === 'suspend_hotkey') {
    const profile = fullConfig.profiles[currentEditProfile];
    if (profile) profile.suspendHotkey = finalVal;
  } else if (targetActionId) {
    const profile = fullConfig.profiles[currentEditProfile];
    if (profile && profile.actions) {
      const act = profile.actions.find(a => a.id === targetActionId);
      if (act) {
        if (targetType === 'hotkey') {
          act.trigger.value = finalVal;
        } else if (targetType === 'comma_keys' || targetType === 'single_key') {
          if (targetType === 'comma_keys') {
            act.keys = finalVal.split(',').map(s => s.trim()).filter(Boolean);
          } else if (act.mode === 'forward' || act.mode === 'key_hold') {
            act.targetKey = finalVal;
          } else {
            act.keys = finalVal.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
      }
    }
  }

  saveCurrentProfile();
  if (fullConfig.profiles[currentEditProfile]) {
    renderActions(fullConfig.profiles[currentEditProfile].actions);
  }

  closeVirtualKeyboard();
}

function buildFinalString() {
  if (targetType === 'comma_keys') {
    return selectedKeys.join(', ');
  }
  const mods = Array.from(selectedModifiers);
  const keysStr = selectedKeys.join(' + ');

  if (mods.length > 0) {
    return keysStr ? `${mods.join(' + ')} + ${keysStr}` : mods.join(' + ');
  }
  return keysStr;
}

function updatePreviewDisplay() {
  const preview = document.getElementById('vk-preview-text');
  if (preview) {
    const str = buildFinalString();
    preview.textContent = str || (currentLang === 'en' ? 'Click keys below to build hotkey...' : 'คลิกเลือกปุ่มด้านล่างเพื่อสร้างปุ่มลัด...');
  }
}

function renderModifierButtonsState() {
  const modBtns = document.querySelectorAll('.vk-mod-btn');
  modBtns.forEach(btn => {
    const val = btn.getAttribute('data-mod');
    const isSel = selectedModifiers.has(val);
    btn.classList.toggle('active', isSel);
    btn.style.background = isSel ? 'var(--primary)' : 'rgba(255,255,255,0.06)';
    btn.style.borderColor = isSel ? 'var(--primary)' : 'rgba(255,255,255,0.15)';
    btn.style.color = isSel ? '#fff' : 'var(--text)';
  });
}

function renderKeyboardUI() {
  updatePreviewDisplay();
  renderModifierButtonsState();
}
