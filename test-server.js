const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(__dirname, 'config.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];
  // Mute periodic polling logs to prevent console noise
  if (!(req.method === 'GET' && (urlPath === '/api/status' || urlPath === '/api/config'))) {
    console.log(`[Server] ${req.method} ${urlPath}`);
  }

  // --- GET /api/config → full config ---
  if (urlPath === '/api/config' && req.method === 'GET') {
    const config = readConfig();
    if (!config) return sendJSON(res, 500, { error: 'Failed to read config' });
    return sendJSON(res, 200, config);
  }

  // --- GET /api/status → active clients list & their statuses ---
  if (urlPath === '/api/status' && req.method === 'GET') {
    const activeList = global.activeClients || [];
    const clientStatuses = {};

    activeList.forEach(clientIdx => {
      const clientStr = String(clientIdx);
      const activeActions = global.activeActions || [];
      const activeLoopStates = global.activeLoopStates || {};
      const activeHoldStates = global.activeHoldStates || {};
      const pressedRemapKeys = global.pressedRemapKeys || {};

      // 1. Buff sequence running?
      if (global.isBuffSequenceRunning && global.isBuffSequenceRunning[clientStr]) {
        const buffAct = activeActions.find(a => a.mode === 'buff_sequence' && (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all'));
        clientStatuses[clientStr] = {
          status: buffAct ? buffAct.name : "Buffing",
          type: "buff"
        };
      // 2. Loop running?
      } else if (activeActions.find(a =>
        a.mode === 'loop' && a.enabled &&
        activeLoopStates[a.id] && activeLoopStates[a.id].running &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      )) {
        const activeLoop = activeActions.find(a =>
          a.mode === 'loop' && a.enabled &&
          activeLoopStates[a.id] && activeLoopStates[a.id].running &&
          (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
        );
        clientStatuses[clientStr] = {
          status: activeLoop.name,
          type: "loop"
        };
      // 3. Key Hold active?
      } else if (activeActions.find(a =>
        a.mode === 'key_hold' && a.enabled && activeHoldStates[a.id] &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      )) {
        const activeHold = activeActions.find(a =>
          a.mode === 'key_hold' && a.enabled && activeHoldStates[a.id] &&
          (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
        );
        clientStatuses[clientStr] = {
          status: activeHold.name || `Hold: ${activeHold.targetKey}`,
          type: "hold"
        };
      // 4. Key Forward active?
      } else if (activeActions.find(a =>
        a.mode === 'forward' && a.enabled && pressedRemapKeys[`${a.id}-${clientStr}`] &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      )) {
        const activeForward = activeActions.find(a =>
          a.mode === 'forward' && a.enabled && pressedRemapKeys[`${a.id}-${clientStr}`] &&
          (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
        );
        clientStatuses[clientStr] = {
          status: activeForward.name || `${activeForward.trigger.value} ➜ ${activeForward.targetKey}`,
          type: "forward"
        };
      } else {
        clientStatuses[clientStr] = {
          status: "Standby",
          type: "standby"
        };
      }
    });

    return sendJSON(res, 200, {
      activeClients: activeList,
      clientStatuses: clientStatuses
    });
  }

  // --- POST /api/overlay/disable → toggle off overlay config ---
  if (urlPath === '/api/overlay/disable' && req.method === 'POST') {
    const config = readConfig();
    if (!config) return sendJSON(res, 500, { error: 'Config read failed' });
    const currentProfile = config.activeProfile;
    if (config.profiles[currentProfile]) {
      config.profiles[currentProfile].enableOverlay = false;
      writeConfig(config);
      console.log(`[Server] Disabled overlay in config profile: ${currentProfile}`);
      sendJSON(res, 200, { success: true });
    } else {
      sendJSON(res, 400, { error: 'Active profile not found' });
    }
    return;
  }

  // --- POST /api/config → save profile settings ---
  if (urlPath === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { profileName, profileData } = JSON.parse(body);
        const config = readConfig();
        if (!config) return sendJSON(res, 500, { error: 'Config read failed' });
        config.profiles[profileName] = profileData;
        writeConfig(config);
        console.log(`[Server] Saved profile: ${profileName}`);
        sendJSON(res, 200, { success: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/new → create new profile ---
  if (urlPath === '/api/profile/new' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, copyFrom } = JSON.parse(body);
        if (!name || name.trim() === '') return sendJSON(res, 400, { error: 'Profile name required' });
        const config = readConfig();
        if (config.profiles[name]) return sendJSON(res, 409, { error: 'Profile already exists' });
        // Copy from specified profile or create blank
        if (!copyFrom || copyFrom.trim() === '') {
          config.profiles[name] = {
            targetUrlKeyword: "universe.flyff.com",
            actions: []
          };
        } else {
          const source = config.profiles[copyFrom] || config.profiles['Default'] || Object.values(config.profiles)[0];
          config.profiles[name] = JSON.parse(JSON.stringify(source));
        }
        writeConfig(config);
        console.log(`[Server] Created profile: ${name}`);
        sendJSON(res, 200, { success: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/delete → delete profile ---
  if (urlPath === '/api/profile/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        if (name === 'Default') return sendJSON(res, 403, { error: 'Cannot delete Default profile' });
        const config = readConfig();
        if (!config.profiles[name]) return sendJSON(res, 404, { error: 'Profile not found' });
        delete config.profiles[name];
        if (config.activeProfile === name) config.activeProfile = 'Default';
        writeConfig(config);
        console.log(`[Server] Deleted profile: ${name}`);
        sendJSON(res, 200, { success: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/activate → switch active profile ---
  if (urlPath === '/api/profile/activate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const config = readConfig();
        if (!config.profiles[name]) return sendJSON(res, 404, { error: 'Profile not found' });
        config.activeProfile = name;
        writeConfig(config);
        console.log(`[Server] Active profile set to: ${name}`);
        sendJSON(res, 200, { success: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- Static file serving ---
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  let fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}/`);
});
