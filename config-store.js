const fs = require('fs');
const path = require('path');

const CONFIGS_DIR = path.join(__dirname, 'configs');
const PROFILES_DIR = path.join(CONFIGS_DIR, 'profiles');
const GLOBAL_CONFIG_PATH = path.join(CONFIGS_DIR, 'global.json');
const LEGACY_CONFIG_PATH = path.join(__dirname, 'config.json');

// Ensure directory structure exists
function ensureDirs() {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

// Migrate legacy single config.json to configs/ directory
function migrateLegacyConfig() {
  ensureDirs();
  if (!fs.existsSync(LEGACY_CONFIG_PATH)) return;

  try {
    const raw = fs.readFileSync(LEGACY_CONFIG_PATH, 'utf8');
    const legacy = JSON.parse(raw);

    // Save global settings
    const activeProfile = legacy.activeProfile || 'Default';
    const globalSettings = legacy.globalSettings || {
      targetUrlKeyword: "universe.flyff.com/play",
      enableOverlay: true,
      suspendHotkey: "END",
      ghostMouseJitter: { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 },
      clientAliases: {},
      clientUserAgents: {},
      clientProxies: {}
    };
    const disabledClients = legacy.disabledClients || [];

    const globalData = {
      activeProfile,
      disabledClients,
      globalSettings
    };
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(globalData, null, 2), 'utf8');

    // Save individual profile files
    const profiles = legacy.profiles || {};
    for (const [pName, pData] of Object.entries(profiles)) {
      const sanitizedName = pName.replace(/[/\\?%*:|"<>]/g, '_');
      const pFile = path.join(PROFILES_DIR, `${sanitizedName}.json`);
      const profileData = {
        name: pName,
        actions: pData.actions || []
      };
      fs.writeFileSync(pFile, JSON.stringify(profileData, null, 2), 'utf8');
    }

    // Rename legacy file to config.json.bak
    const bakPath = path.join(__dirname, 'config.json.bak');
    fs.renameSync(LEGACY_CONFIG_PATH, bakPath);
    console.log(`[Config Store] 🚀 Migrated legacy config.json into configs/ folder successfully! (Backup: config.json.bak)`);
  } catch (e) {
    console.error(`[Config Store Error] Migration failed:`, e.message);
  }
}

// Read and assemble full configuration object
function readConfig() {
  ensureDirs();
  if (fs.existsSync(LEGACY_CONFIG_PATH)) {
    migrateLegacyConfig();
  }

  let activeProfile = 'Default';
  let disabledClients = [];
  let globalSettings = {
    targetUrlKeyword: "universe.flyff.com/play",
    enableOverlay: true,
    suspendHotkey: "END",
    ghostMouseJitter: { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 },
    clientAliases: {},
    clientUserAgents: {},
    clientProxies: {}
  };

  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const globalRaw = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
      const gParsed = JSON.parse(globalRaw);
      if (gParsed.activeProfile) activeProfile = gParsed.activeProfile;
      if (gParsed.disabledClients) disabledClients = gParsed.disabledClients;
      if (gParsed.globalSettings) globalSettings = gParsed.globalSettings;
    } catch (e) {
      console.error(`[Config Store Error] Failed to read global.json:`, e.message);
    }
  }

  const profiles = {};
  if (fs.existsSync(PROFILES_DIR)) {
    const files = fs.readdirSync(PROFILES_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const fPath = path.join(PROFILES_DIR, f);
      try {
        const pRaw = fs.readFileSync(fPath, 'utf8');
        const pData = JSON.parse(pRaw);
        const name = pData.name || path.basename(f, '.json');
        profiles[name] = {
          actions: pData.actions || []
        };
      } catch (e) {
        console.error(`[Config Store Error] Failed to read profile file ${f}:`, e.message);
      }
    }
  }

  if (Object.keys(profiles).length === 0) {
    profiles['Default'] = { actions: [] };
  }
  if (!profiles[activeProfile]) {
    activeProfile = Object.keys(profiles)[0];
  }

  // Attach globalSettings values to all profiles for full backwards compatibility
  for (const pName of Object.keys(profiles)) {
    profiles[pName].targetUrlKeyword = globalSettings.targetUrlKeyword;
    profiles[pName].enableOverlay = globalSettings.enableOverlay;
    profiles[pName].suspendHotkey = globalSettings.suspendHotkey;
    profiles[pName].ghostMouseJitter = globalSettings.ghostMouseJitter;
    profiles[pName].clientAliases = globalSettings.clientAliases;
    profiles[pName].clientUserAgents = globalSettings.clientUserAgents;
    profiles[pName].clientProxies = globalSettings.clientProxies;
  }

  return {
    activeProfile,
    disabledClients,
    globalSettings,
    profiles
  };
}

// Write full configuration object into multi-file structure
function writeConfig(fullConfig) {
  ensureDirs();
  if (!fullConfig) return;

  const activeProfile = fullConfig.activeProfile || 'Default';
  const disabledClients = fullConfig.disabledClients || [];
  const globalSettings = fullConfig.globalSettings || {};

  const globalData = {
    activeProfile,
    disabledClients,
    globalSettings
  };
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(globalData, null, 2), 'utf8');

  // Save profile files and handle deletions
  const profiles = fullConfig.profiles || {};
  const currentFiles = fs.existsSync(PROFILES_DIR) ? fs.readdirSync(PROFILES_DIR) : [];
  const validFilenames = new Set();

  for (const [pName, pData] of Object.entries(profiles)) {
    const sanitizedName = pName.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${sanitizedName}.json`;
    validFilenames.add(filename);
    const pFile = path.join(PROFILES_DIR, filename);

    const profileData = {
      name: pName,
      actions: pData.actions || []
    };
    fs.writeFileSync(pFile, JSON.stringify(profileData, null, 2), 'utf8');
  }

  // Remove files for deleted profiles
  for (const f of currentFiles) {
    if (f.endsWith('.json') && !validFilenames.has(f)) {
      try {
        fs.unlinkSync(path.join(PROFILES_DIR, f));
        console.log(`[Config Store] 🗑️ Deleted removed profile file: ${f}`);
      } catch (e) {}
    }
  }
}

module.exports = {
  readConfig,
  writeConfig,
  migrateLegacyConfig,
  CONFIGS_DIR,
  PROFILES_DIR,
  GLOBAL_CONFIG_PATH
};
