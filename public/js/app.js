import { currentLang, changeLang, TRANSLATIONS, t } from './i18n.js';
import {
  fullConfig,
  currentEditProfile,
  activeClients,
  loadConfig,
  saveCurrentProfile,
  onManualSaveProfile,
  activateProfile,
  onProfileSelectChange,
  openNewProfileModal,
  confirmNewProfile,
  openRenameProfileModal,
  confirmRenameProfile,
  deleteProfile,
  toggleGhostMouseSettings,
  populateProfileDropdowns,
  loadProfileToUI,
  pollActiveClients,
  toggleClientEnable,
  renderClientToggles,
  launchClient,
  closeClient
} from './state.js';
import {
  startRecordingKey,
  stopRecordingKey,
  startRecordingSuspendHotkey,
  clearSuspendHotkey,
  setRecordSaveCallback
} from './key-recorder.js';
import {
  fetchCooldownPresets,
  openSkillPickerModal,
  closeSkillPickerModal,
  renderSkillPickerClassTabs,
  renderSkillPickerGrid,
  selectSkillForAction
} from './cooldown.js';
import {
  initActionsModule,
  renderActions,
  addNewAction,
  deleteAction,
  toggleActionAccordion,
  toggleChainAccordion,
  toggleClientSelection,
  onTriggerTypeChange,
  onModeChange,
  toggleForwardDelayDisplay,
  addFirstStepToAction,
  removeFirstStepFromAction,
  syncActionFromDom,
  syncIntervalRange,
  syncIntervalInput,
  onChainEnabledToggle,
  toggleChainItem,
  toggleControlTargetItem,
  onControlOperationChange
} from './components/actions.js';
import {
  openAntiDetectModal,
  closeAntiDetectModal,
  randomizeUserAgent,
  randomizeAllUserAgents,
  clearUserAgent,
  saveAntiDetectSettings,
  openProxyModal,
  closeProxyModal,
  clearProxy,
  saveProxySettings,
  openClientSettingsModal,
  closeClientSettingsModal,
  randomizeClientModalUA,
  clearClientModalUA,
  clearClientModalProxy,
  saveClientSettingsModal
} from './components/modal.js';
import {
  toast,
  addLog,
  clearLogs,
  flashKey,
  updateSuspendButtonUI,
  toggleSuspendState,
  setup3D
} from './components/logs.js';
import {
  openVirtualKeyboard,
  closeVirtualKeyboard,
  toggleModifier,
  pressVirtualKey,
  clearVirtualKeyboard,
  popVirtualKey,
  toggleManualMode,
  applyVirtualKeyboard
} from './virtual-keyboard.js';
import { validateProfile, autoFixProfile } from './validator.js';

// Expose functions required by inline HTML event attributes & global calls
window.changeLang = (lang) => {
  changeLang(lang, (newLang) => {
    updateLanguageUI();
  });
};
window.onProfileSelectChange = onProfileSelectChange;
window.activateProfile = activateProfile;
window.openNewProfileModal = openNewProfileModal;
window.closeNewProfileModal = () => document.getElementById('new-profile-modal')?.classList.remove('show');
window.confirmNewProfile = confirmNewProfile;
window.openRenameProfileModal = openRenameProfileModal;
window.closeRenameProfileModal = () => document.getElementById('rename-profile-modal')?.classList.remove('show');
window.confirmRenameProfile = confirmRenameProfile;
window.deleteProfile = deleteProfile;
window.toggleGhostMouseSettings = toggleGhostMouseSettings;
window.saveCurrentProfile = saveCurrentProfile;
window.onManualSaveProfile = onManualSaveProfile;
window.toggleClientEnable = toggleClientEnable;
window.launchClient = launchClient;
window.closeClient = closeClient;

window.startRecordingKey = startRecordingKey;
window.stopRecordingKey = stopRecordingKey;
window.startRecordingSuspendHotkey = startRecordingSuspendHotkey;
window.clearSuspendHotkey = () => clearSuspendHotkey(() => saveCurrentProfile());

window.openVirtualKeyboard = openVirtualKeyboard;
window.closeVirtualKeyboard = closeVirtualKeyboard;
window.toggleModifier = toggleModifier;
window.pressVirtualKey = pressVirtualKey;
window.clearVirtualKeyboard = clearVirtualKeyboard;
window.popVirtualKey = popVirtualKey;
window.toggleManualMode = toggleManualMode;
window.applyVirtualKeyboard = applyVirtualKeyboard;

window.syncIntervalRange = syncIntervalRange;
window.syncIntervalInput = syncIntervalInput;

window.openSkillPickerModal = (actionId) => openSkillPickerModal(actionId, renderActions);
window.closeSkillPickerModal = closeSkillPickerModal;
window.selectPickerClassTab = (className) => {
  renderSkillPickerClassTabs();
  renderSkillPickerGrid(renderActions);
};
window.selectSkillForAction = (presetId) => selectSkillForAction(presetId, renderActions);

window.addNewAction = addNewAction;
window.deleteAction = deleteAction;
window.toggleActionAccordion = toggleActionAccordion;
window.toggleChainAccordion = toggleChainAccordion;
window.toggleClientSelection = toggleClientSelection;
window.onTriggerTypeChange = onTriggerTypeChange;
window.onModeChange = onModeChange;
window.toggleForwardDelayDisplay = toggleForwardDelayDisplay;
window.addFirstStepToAction = addFirstStepToAction;
window.removeFirstStepFromAction = removeFirstStepFromAction;
window.onChainEnabledToggle = onChainEnabledToggle;
window.toggleChainItem = toggleChainItem;
window.toggleControlTargetItem = toggleControlTargetItem;
window.onControlOperationChange = onControlOperationChange;

window.openAntiDetectModal = openAntiDetectModal;
window.closeAntiDetectModal = closeAntiDetectModal;
window.randomizeUserAgent = randomizeUserAgent;
window.randomizeAllUserAgents = randomizeAllUserAgents;
window.clearUserAgent = clearUserAgent;
window.saveAntiDetectSettings = saveAntiDetectSettings;

window.openProxyModal = openProxyModal;
window.closeProxyModal = closeProxyModal;
window.clearProxy = clearProxy;
window.saveProxySettings = saveProxySettings;

window.openClientSettingsModal = openClientSettingsModal;
window.closeClientSettingsModal = closeClientSettingsModal;
window.randomizeClientModalUA = randomizeClientModalUA;
window.clearClientModalUA = clearClientModalUA;
window.clearClientModalProxy = clearClientModalProxy;
window.saveClientSettingsModal = saveClientSettingsModal;

window.toggleSuspendState = toggleSuspendState;
window.toast = toast;
window.addLog = addLog;
window.clearLogs = clearLogs;

// ─── Validator Modal Functions ───
window.openValidatorModal = function() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;

  const { issues, errorCount, warningCount } = validateProfile(profile.actions);
  const lang = currentLang;

  // If no issues, show clean toast and skip modal
  if (issues.length === 0) {
    toast(t('toastProfileValidatedClean') || '✓ Profile is clean!', 'success');
    return;
  }

  // Render summary bar
  const summaryEl = document.getElementById('validator-summary');
  summaryEl.innerHTML = `
    <span style="color:#ef4444;">🔴 ${lang === 'en' ? 'Errors' : 'ข้อผิดพลาด'}: <strong>${errorCount}</strong></span>
    <span style="color:#f59e0b;">🟡 ${lang === 'en' ? 'Warnings' : 'คำเตือน'}: <strong>${warningCount}</strong></span>
    <span style="color:var(--muted); margin-left:auto; font-size:11px;">${lang === 'en' ? 'Total' : 'ทั้งหมด'}: ${issues.length}</span>
  `;

  // Render issues list
  const listEl = document.getElementById('validator-issues-list');
  listEl.innerHTML = '';
  issues.forEach((issue, idx) => {
    const severityColor = issue.severity === 'error' ? '#ef4444' : '#f59e0b';
    const severityIcon = issue.severity === 'error' ? '🔴' : '🟡';
    const severityLabel = issue.severity === 'error'
      ? (lang === 'en' ? 'ERROR' : 'ผิดพลาด')
      : (lang === 'en' ? 'WARNING' : 'คำเตือน');
    const message = lang === 'th' ? issue.messageTh : issue.messageEn;
    const fixBadge = issue.autoFixable
      ? `<span style="background:rgba(168,85,247,0.15); color:#c084fc; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700;">AUTO-FIX</span>`
      : `<span style="background:rgba(239,68,68,0.1); color:#f87171; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700;">${lang === 'en' ? 'MANUAL' : 'แก้เอง'}</span>`;

    const issueCard = document.createElement('div');
    issueCard.style.cssText = `padding:10px 14px; background:rgba(255,255,255,0.025); border:1px solid ${severityColor}33; border-radius:8px; border-left:3px solid ${severityColor};`;
    issueCard.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <span>${severityIcon}</span>
        <span style="color:${severityColor}; font-size:10px; font-weight:700; text-transform:uppercase;">${severityLabel}</span>
        ${fixBadge}
        <span style="color:var(--muted); font-size:10px; margin-left:auto;">#${idx + 1}</span>
      </div>
      <div style="font-size:12px; color:var(--text); font-weight:600; margin-bottom:2px;">📌 ${issue.actionName}</div>
      <div style="font-size:11px; color:var(--muted);">${message}</div>
    `;
    listEl.appendChild(issueCard);
  });

  // Show/hide auto-fix button
  const autoFixBtn = document.getElementById('validator-autofix-btn');
  const hasFixable = issues.some(i => i.autoFixable);
  autoFixBtn.style.display = hasFixable ? 'inline-flex' : 'none';

  document.getElementById('validator-modal').classList.add('show');
};

window.closeValidatorModal = function() {
  document.getElementById('validator-modal')?.classList.remove('show');
};

window.autoFixFromModal = function() {
  const fixedCount = autoFixProfile();
  closeValidatorModal();
  if (fixedCount > 0) {
    const msg = (t('toastProfileAutoFixed') || '✓ Automatically resolved {count} issue(s)!').replace('{count}', fixedCount);
    toast(msg, 'success');
  }
};

function updateLanguageUI() {
  const lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
      if (key === 'applySave') {
        el.innerHTML = `💾 ${TRANSLATIONS[lang][key].substring(2)}`;
      } else if (key === 'addCustomAction') {
        el.innerHTML = `➕ ${TRANSLATIONS[lang][key].substring(2)}`;
      } else {
        el.textContent = TRANSLATIONS[lang][key];
      }
    }
  });

  const nameInput = document.getElementById('new-profile-name');
  if (nameInput) {
    nameInput.placeholder = lang === 'en' ? 'e.g. Healer-PvP' : 'เช่น Healer-PvP';
  }

  const urlInput = document.getElementById('target-url-keyword');
  if (urlInput) {
    urlInput.placeholder = lang === 'en' ? 'e.g. universe.flyff.com' : 'เช่น universe.flyff.com';
  }

  populateProfileDropdowns();

  if (fullConfig.profiles[currentEditProfile]) {
    loadProfileToUI(fullConfig.profiles[currentEditProfile]);
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.classList.contains(lang));
  });
}

// Global Event Listeners Setup & Initialization
async function initApp() {
  initActionsModule();
  setup3D();

  setRecordSaveCallback((actionId, type, value) => {
    if (type === 'suspend_hotkey') {
      const profile = fullConfig.profiles[currentEditProfile];
      if (profile) profile.suspendHotkey = value;
    } else if (actionId) {
      syncActionFromDom(actionId);
    }
    saveCurrentProfile();
  });

  await fetchCooldownPresets();
  loadConfig();
  updateLanguageUI();
  renderClientToggles();
  checkAppUpdate();

  // Multi-select custom dropdown behavior without Ctrl key
  window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'OPTION' && e.target.parentNode.multiple) {
      e.preventDefault();
      const select = e.target.parentNode;
      const scroll = select.scrollTop;
      e.target.selected = !e.target.selected;
      setTimeout(() => { select.scrollTop = scroll; }, 0);
      select.dispatchEvent(new Event('change'));
    }
  }, true);

  // Periodic status poll
  setInterval(() => {
    pollActiveClients();
  }, 3000);
}

async function checkAppUpdate() {
  try {
    const res = await fetch('/api/update-check');
    const data = await res.json();
    if (data.hasUpdate) {
      const container = document.getElementById('update-badge-container');
      const textEl = document.getElementById('update-badge-text');
      const linkEl = document.getElementById('update-badge-link');

      if (container && textEl) {
        textEl.textContent = `🚀 Update v${data.latestVersion} Available!`;
        if (linkEl && data.repoUrl) linkEl.href = data.repoUrl;
        container.style.display = 'block';
      }

      if (typeof window.toast === 'function') {
        window.toast(`🚀 GitHub Update Available: v${data.latestVersion}!`, 'info');
      }
    }
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
