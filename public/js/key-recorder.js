export let activeRecordingInput = null;
export let activeRecordingActionId = null;
export let activeRecordingType = null; // 'hotkey', 'single_key', 'comma_keys', 'suspend_hotkey'

let recordingHeldModifiers = [];
let recordingNonModifierPressed = false;

const modifierKeyNames = [
  'LEFT ALT', 'RIGHT ALT', 'ALT',
  'LEFT CTRL', 'RIGHT CTRL', 'CTRL',
  'LEFT SHIFT', 'RIGHT SHIFT', 'SHIFT'
];

let onRecordSaveCallback = null;

export function setRecordSaveCallback(cb) {
  onRecordSaveCallback = cb;
}

export function startRecordingKey(input, actionId, type) {
  if (activeRecordingInput && activeRecordingInput !== input) {
    stopRecordingKey(activeRecordingInput);
  }
  activeRecordingInput = input;
  activeRecordingActionId = actionId;
  activeRecordingType = type;
  recordingHeldModifiers = [];
  recordingNonModifierPressed = false;

  input.value = '';
  input.placeholder = type === 'comma_keys' ? 'Press keys sequentially...' : 'Press any key...';
  input.style.borderColor = 'var(--primary)';
  input.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)';

  window.addEventListener('keydown', handleRecordingKeyDown, true);
  window.addEventListener('keyup', handleRecordingKeyUp, true);
}

export function stopRecordingKey(input) {
  if (activeRecordingInput === input) {
    window.removeEventListener('keydown', handleRecordingKeyDown, true);
    window.removeEventListener('keyup', handleRecordingKeyUp, true);
    recordingHeldModifiers = [];
    recordingNonModifierPressed = false;

    let placeholderText = 'Click to bind key...';
    if (activeRecordingType === 'comma_keys') {
      placeholderText = 'Click to record...';
    } else if (activeRecordingType === 'suspend_hotkey') {
      placeholderText = 'Click to bind key...';
    }

    input.placeholder = placeholderText;
    input.style.borderColor = 'var(--border)';
    input.style.boxShadow = 'none';

    if (typeof onRecordSaveCallback === 'function') {
      onRecordSaveCallback(activeRecordingActionId, activeRecordingType, input.value.trim());
    }

    activeRecordingInput = null;
    activeRecordingActionId = null;
    activeRecordingType = null;
  }
}

export function startRecordingSuspendHotkey(input) {
  if (activeRecordingInput && activeRecordingInput !== input) {
    stopRecordingKey(activeRecordingInput);
  }
  activeRecordingInput = input;
  activeRecordingActionId = null;
  activeRecordingType = 'suspend_hotkey';
  recordingHeldModifiers = [];
  recordingNonModifierPressed = false;

  input.value = '';
  input.placeholder = 'Press any key...';
  input.style.borderColor = 'var(--primary)';
  input.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)';

  window.addEventListener('keydown', handleRecordingKeyDown, true);
  window.addEventListener('keyup', handleRecordingKeyUp, true);
}

export function clearSuspendHotkey(onClearCb) {
  const input = document.getElementById('suspend-hotkey-input');
  if (input) {
    input.value = '';
  }
  if (typeof onClearCb === 'function') {
    onClearCb();
  }
}

function handleRecordingKeyDown(e) {
  if (!activeRecordingInput) return;
  e.preventDefault();
  e.stopPropagation();

  const cleanKey = mapJsKeyToGlobalListenerKey(e);

  const restrictedKeys = [
    'ESCAPE',
    'META', 'LEFT META', 'RIGHT META',
    'CONTEXT MENU', 'SELECT', 'PRINTSCREEN', 'PAUSE'
  ];

  if (restrictedKeys.includes(cleanKey)) {
    if (typeof window.toast === 'function') {
      window.toast(`⚠️ Key "${cleanKey}" is restricted!`, 'error');
    }
    activeRecordingInput.blur();
    return;
  }

  if (activeRecordingType === 'comma_keys') {
    const currentVal = activeRecordingInput.value.trim();
    if (currentVal === '') {
      activeRecordingInput.value = cleanKey;
    } else {
      const keys = currentVal.split(',').map(s => s.trim());
      if (keys[keys.length - 1] !== cleanKey) {
        activeRecordingInput.value = currentVal + ', ' + cleanKey;
      }
    }
    return;
  }

  if (modifierKeyNames.includes(cleanKey)) {
    if (!recordingHeldModifiers.includes(cleanKey)) {
      recordingHeldModifiers.push(cleanKey);
    }
    activeRecordingInput.value = recordingHeldModifiers.join(' + ') + ' + ...';
    return;
  }

  recordingNonModifierPressed = true;
  let finalKeyCombo = cleanKey;
  if (recordingHeldModifiers.length > 0) {
    finalKeyCombo = recordingHeldModifiers.join(' + ') + ' + ' + cleanKey;
  }

  applyRecordedKey(finalKeyCombo);
}

function handleRecordingKeyUp(e) {
  if (!activeRecordingInput) return;
  e.preventDefault();
  e.stopPropagation();

  const cleanKey = mapJsKeyToGlobalListenerKey(e);
  if (modifierKeyNames.includes(cleanKey) && !recordingNonModifierPressed && recordingHeldModifiers.length > 0) {
    const finalKeyCombo = recordingHeldModifiers.join(' + ');
    applyRecordedKey(finalKeyCombo);
  }
}

function applyRecordedKey(keyCombo) {
  activeRecordingInput.value = keyCombo;
  activeRecordingInput.blur();
}

export function mapJsKeyToGlobalListenerKey(e) {
  const code = e.code;
  const key = e.key;

  if (/^F\d+$/.test(key)) {
    return key.toUpperCase();
  }

  if (code.startsWith('Numpad')) {
    if (code.length === 7) {
      return 'NUMPAD ' + code.charAt(6);
    }
    if (code === 'NumpadDivide') return 'NUMPAD DIVIDE';
    if (code === 'NumpadMultiply') return 'NUMPAD MULTIPLY';
    if (code === 'NumpadSubtract') return 'NUMPAD MINUS';
    if (code === 'NumpadAdd') return 'NUMPAD PLUS';
    if (code === 'NumpadDecimal') return 'NUMPAD DOT';
    if (code === 'NumpadEnter') return 'NUMPAD ENTER';
  }

  if (code.startsWith('Key')) {
    return code.replace('Key', '').toUpperCase();
  }
  if (code.startsWith('Digit')) {
    return code.replace('Digit', '').toUpperCase();
  }

  const codeSymbolMap = {
    'Minus': 'MINUS',
    'Equal': 'EQUALS',
    'BracketLeft': 'SQUARE BRACKETS OPEN',
    'BracketRight': 'SQUARE BRACKETS CLOSE',
    'Semicolon': 'SEMICOLON',
    'Quote': 'QUOTE',
    'Backquote': 'BACKTICK',
    'Backslash': 'BACKSLASH',
    'Comma': 'COMMA',
    'Period': 'DOT',
    'Slash': 'FORWARD SLASH'
  };

  if (codeSymbolMap[code]) {
    return codeSymbolMap[code];
  }

  const specialMap = {
    ' ': 'SPACE',
    'Spacebar': 'SPACE',
    'Escape': 'ESCAPE',
    'Esc': 'ESCAPE',
    'Insert': 'INSERT',
    'Delete': 'DELETE',
    'Home': 'HOME',
    'End': 'END',
    'PageUp': 'PAGE UP',
    'PageDown': 'PAGE DOWN',
    'ArrowUp': 'ARROW UP',
    'ArrowDown': 'ARROW DOWN',
    'ArrowLeft': 'ARROW LEFT',
    'ArrowRight': 'ARROW RIGHT',
    'Tab': 'TAB',
    'CapsLock': 'CAPS LOCK',
    'Backspace': 'BACKSPACE',
    'Enter': 'ENTER',
    'ShiftLeft': 'LEFT SHIFT',
    'ShiftRight': 'RIGHT SHIFT',
    'ControlLeft': 'LEFT CTRL',
    'ControlRight': 'RIGHT CTRL',
    'AltLeft': 'LEFT ALT',
    'AltRight': 'RIGHT ALT',
    'MetaLeft': 'LEFT META',
    'MetaRight': 'RIGHT META',
    'Shift': 'SHIFT',
    'Control': 'CTRL',
    'Alt': 'ALT',
    'Meta': 'META',
    'ContextMenu': 'CONTEXT MENU',
    'PrintScreen': 'PRINTSCREEN',
    'ScrollLock': 'SCROLL LOCK',
    'Pause': 'PAUSE',
    'NumLock': 'NUM LOCK'
  };

  if (specialMap[code]) {
    return specialMap[code];
  }
  if (specialMap[key]) {
    return specialMap[key];
  }

  return key.toUpperCase();
}
