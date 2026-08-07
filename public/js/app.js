import { currentLang, changeLang, TRANSLATIONS, t } from './i18n.js';
import {
  fullConfig,
  currentEditProfile,
  activeClients,
  loadConfig,
  saveCurrentProfile,
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
  syncIntervalInput
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
