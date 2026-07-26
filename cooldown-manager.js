const fs = require('fs');
const path = require('path');

function getCooldownPresets() {
  const result = {};
  const skillsDir = path.join(__dirname, 'public', 'images', 'skills');

  if (fs.existsSync(skillsDir)) {
    try {
      const classDirs = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const d of classDirs) {
        if (d.isDirectory()) {
          const className = d.name; // e.g. "Assist", "Ringmaster", "Vagrant"
          const presetPath = path.join(skillsDir, className, 'presets.json');
          if (fs.existsSync(presetPath)) {
            try {
              const data = fs.readFileSync(presetPath, 'utf8');
              const items = JSON.parse(data);
              if (Array.isArray(items)) {
                result[className] = items.map(item => ({
                  ...item,
                  class: className
                }));
              } else if (typeof items === 'object' && items !== null) {
                const flattened = [];
                for (const k in items) {
                  if (Array.isArray(items[k])) {
                    flattened.push(...items[k]);
                  }
                }
                if (flattened.length > 0) {
                  result[className] = flattened.map(item => ({
                    ...item,
                    class: className
                  }));
                }
              }
            } catch (e) {
              console.error(`[CooldownManager] Error reading ${presetPath}:`, e.message);
            }
          }
        }
      }
    } catch (e) {
      console.error(`[CooldownManager] Error scanning skills directory:`, e.message);
    }
  }

  // Also check root cooldown_presets.json if present
  const rootPresetsPath = path.join(__dirname, 'cooldown_presets.json');
  if (fs.existsSync(rootPresetsPath)) {
    try {
      const data = fs.readFileSync(rootPresetsPath, 'utf8');
      const rootJson = JSON.parse(data);
      if (Array.isArray(rootJson)) {
        result['Custom'] = rootJson;
      } else if (rootJson.cooldownPresets && Array.isArray(rootJson.cooldownPresets)) {
        result['Custom'] = rootJson.cooldownPresets;
      }
    } catch (e) {}
  }

  return result;
}

function getCooldownPresetsById() {
  const grouped = getCooldownPresets();
  const byId = {};
  for (const className in grouped) {
    for (const item of grouped[className]) {
      if (item && item.id) {
        byId[item.id] = item;
      }
    }
  }
  return byId;
}

function getClassIcons() {
  const icons = {};
  const skillsDir = path.join(__dirname, 'public', 'images', 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      const classDirs = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const d of classDirs) {
        if (d.isDirectory()) {
          const className = d.name;
          const classIconPath = path.join(skillsDir, className, 'class.png');
          if (fs.existsSync(classIconPath)) {
            icons[className] = `/images/skills/${className}/class.png`;
          }
        }
      }
    } catch (e) {}
  }
  return icons;
}

module.exports = {
  getCooldownPresets,
  getCooldownPresetsById,
  getClassIcons
};
