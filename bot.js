const { chromium, firefox } = require('playwright');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Start the control panel server
require('./test-server.js');

let keyboard, mouseEvents;
let clientPages = {};    // clientIndex -> page
let clientContexts = {}; // clientIndex -> browserContext
let activeClients = [];  // Array of active client indices, e.g. [2, 4]

// ============================================================================
// CONFIGURATION VARIABLES
// ============================================================================
let targetUrlKeyword = 'universe.flyff.com'; // URL keyword to identify game tab

let activeActions = [];
let clientAliases = {};
let clientUserAgents = {};
let suspendHotkey = "";
global.isSuspended = false;
let pressedRemapKeys = {};
let activeHoldStates = {};
let forwardHoldTimers = {};
let activeLoopStates = {};
let isBuffSequenceRunning = {};
global.activeLoopStates = activeLoopStates;
global.isBuffSequenceRunning = isBuffSequenceRunning;
global.pressedRemapKeys = pressedRemapKeys;
global.activeHoldStates = activeHoldStates;
let isSystemInitialized = false;
let overlayProcess = null;
const { spawn } = require('child_process');

// Ghost Mouse Jitter state
let ghostMouseJitterConfig = { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 };
let ghostMouseJitterTimers = {}; // clientIndex -> timeout handle

function getActionTargets(targetClientString) {
    if (!targetClientString) return ['1'];
    if (targetClientString === 'all' || targetClientString === 'both') {
        return activeClients.map(String);
    }
    const split = targetClientString.split(',').map(s => s.trim()).filter(Boolean);
    return split.length > 0 ? split : ['1'];
}

function isTargetMatched(targetClientString, clientStr) {
    const targets = getActionTargets(targetClientString);
    return targets.includes(clientStr);
}

function releaseAllHeldKeys() {
    for (let actionId in activeHoldStates) {
        if (activeHoldStates[actionId]) {
            const act = activeActions.find(a => a.id === actionId);
            if (act && act.mode === 'key_hold') {
                const targetKey = act.targetKey || '1';
                let targets = getActionTargets(act.targetClient).map(x => parseInt(x, 10));
                for (let t of targets) {
                    const page = clientPages[t];
                    if (page) {
                        page.keyboard.up(targetKey).catch(e => {});
                    }
                }
            }
            activeHoldStates[actionId] = false;
        }
    }
    for (let key in forwardHoldTimers) {
        clearTimeout(forwardHoldTimers[key]);
        delete forwardHoldTimers[key];
    }
}

// Helper to load config from JSON file
function loadConfigFromFile() {
    try {
        releaseAllHeldKeys();
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(data);

            // Support new multi-profile structure
            let profile;
            if (parsed.profiles && parsed.activeProfile) {
                const activeProfile = parsed.activeProfile;
                profile = parsed.profiles[activeProfile];
                console.log(`[Config] Using profile: "${activeProfile}"`);
            } else {
                // Legacy flat config fallback
                profile = parsed;
                console.log(`[Config] Using legacy flat config`);
            }

            // Load target URL keyword
            targetUrlKeyword = profile.targetUrlKeyword || 'universe.flyff.com';
            suspendHotkey = profile.suspendHotkey || '';

            // Load actions array
            if (profile.actions && Array.isArray(profile.actions)) {
                activeActions = profile.actions;
            } else {
                activeActions = [];
            }
            global.activeActions = activeActions; // Share with test-server.js

            // Load client aliases
            clientAliases = profile.clientAliases || {};

            // Load client User-Agents
            clientUserAgents = profile.clientUserAgents || {};

            // Load Ghost Mouse Jitter config
            if (profile.ghostMouseJitter) {
                ghostMouseJitterConfig = {
                    enabled: !!profile.ghostMouseJitter.enabled,
                    intervalMin: profile.ghostMouseJitter.intervalMin || 8000,
                    intervalMax: profile.ghostMouseJitter.intervalMax || 25000,
                    maxOffset: profile.ghostMouseJitter.maxOffset || 12
                };
            } else {
                ghostMouseJitterConfig = { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 };
            }

            // Sync state of active loops
            syncRunningLoops();

            // Sync Python overlay process
            syncOverlayProcess(!!profile.enableOverlay);

            // Sync Ghost Mouse Jitter
            syncGhostMouseJitter();

            // Update browser titles if running
            updateBrowserTitles();

            // Send state to overlay
            sendOverlayUpdate();

            console.log(`[Config] Loaded ${activeActions.length} actions successfully!`);
        } else {
            console.log("[Config Error] config.json does not exist. Creating defaults...");
            // Create default multi-profile file if missing
            const defaults = {
                activeProfile: "Default",
                profiles: {
                    Default: {
                        targetUrlKeyword: "universe.flyff.com",
                        actions: [
                            {
                                id: "action_1",
                                name: "Healing Loop",
                                mode: "loop",
                                trigger: { type: "keyboard", value: "F9" },
                                keys: ["2"],
                                interval: 3000,
                                jitter: 250,
                                firstSteps: [{ key: "3", delay: 500 }],
                                enabled: true,
                                targetClient: "1"
                            },
                            {
                                id: "action_2",
                                name: "Mini Healing Loop",
                                mode: "loop",
                                trigger: { type: "keyboard", value: "F10" },
                                keys: ["1"],
                                interval: 1500,
                                jitter: 150,
                                firstSteps: [],
                                enabled: true,
                                targetClient: "1"
                            },
                            {
                                id: "action_3",
                                name: "Between Healing Loop",
                                mode: "loop",
                                trigger: { type: "keyboard", value: "F8" },
                                keys: ["3"],
                                interval: 40000,
                                jitter: 2000,
                                firstSteps: [],
                                enabled: true,
                                targetClient: "1"
                            },
                            {
                                id: "action_4",
                                name: "Buff Sequence",
                                mode: "buff_sequence",
                                trigger: { type: "keyboard", value: "INSERT" },
                                keys: ["F3", "1", "2", "3", "4", "5", "6", "7", "F4", "1", "2", "3", "4", "5", "F1"],
                                delayBuff: 800,
                                enabled: true,
                                targetClient: "1"
                            }
                        ]
                    }
                }
            };
            fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf8');
            loadConfigFromFile();
        }
    } catch (e) {
        console.error("[Config Error] Failed to read config.json:", e.message);
    }
}


// Watch config file for live modifications
function watchConfigChanges() {
    const configPath = path.join(__dirname, 'config.json');
    fs.watchFile(configPath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            console.log("\n[Config] config.json modification detected. Reloading...");
            loadConfigFromFile();
        }
    });
}

// Load config immediately on startup
loadConfigFromFile();
watchConfigChanges();

// ============================================================================
// SYSTEM STATE & TIMERS
// ============================================================================
// (Variables hoisted to the top to avoid ReferenceError)

function sendOverlayUpdate() {
    if (!overlayProcess) return;
    const activeList = activeClients || [];
    const clientStatuses = {};
    activeList.forEach(clientIdx => {
        const clientStr = String(clientIdx);
        if (isBuffSequenceRunning[clientStr]) {
            const buffAct = activeActions.find(a => a.mode === 'buff_sequence' && isTargetMatched(a.targetClient, clientStr));
            clientStatuses[clientStr] = {
                status: buffAct ? buffAct.name : "Buffing",
                type: "buff"
            };
        } else {
            const activeLoop = activeActions.find(a => 
                a.mode === 'loop' && 
                a.enabled && 
                activeLoopStates[a.id] && 
                activeLoopStates[a.id].running &&
                isTargetMatched(a.targetClient, clientStr)
            );
            if (activeLoop) {
                clientStatuses[clientStr] = {
                    status: activeLoop.name,
                    type: "loop"
                };
            } else {
                const activeHold = activeActions.find(a =>
                    a.mode === 'key_hold' &&
                    a.enabled &&
                    activeHoldStates[a.id] &&
                    isTargetMatched(a.targetClient, clientStr)
                );
                if (activeHold) {
                    clientStatuses[clientStr] = {
                        status: activeHold.name || `Hold: ${activeHold.targetKey}`,
                        type: "hold"
                    };
                } else {
                    const activeForward = activeActions.find(a =>
                        a.mode === 'forward' &&
                        a.enabled &&
                        pressedRemapKeys[`${a.id}-${clientStr}`] &&
                        isTargetMatched(a.targetClient, clientStr)
                    );
                    if (activeForward) {
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
                }
            }
        }
    });
    const payload = JSON.stringify({ activeClients: activeList, clientStatuses, clientAliases, isSuspended: !!global.isSuspended });
    try {
        overlayProcess.stdin.write(payload + "\n");
    } catch (err) {
        // Ignored
    }
}

global.toggleSuspendState = function(forcedState) {
    if (forcedState !== undefined) {
        global.isSuspended = forcedState;
    } else {
        global.isSuspended = !global.isSuspended;
    }
    
    console.log(`\n[System Pause/Resume] Bot is now ${global.isSuspended ? '⏸️ PAUSED/SUSPENDED' : '▶️ ACTIVE/RESUMED'}`);
    
    if (global.isSuspended) {
        // Stop all loops
        stopAllLoops();
        
        // Release all key holds
        for (let actionId in activeHoldStates) {
            if (activeHoldStates[actionId]) {
                activeHoldStates[actionId] = false;
                const act = activeActions.find(a => a.id === actionId);
                if (act) {
                    const target = act.targetClient || '1';
                    let targets = getActionTargets(target).map(x => parseInt(x, 10));
                    for (let t of targets) {
                        const page = clientPages[t];
                        if (page) {
                            page.keyboard.up(act.targetKey || '1').catch(e => {});
                        }
                    }
                }
            }
        }
        // Release all remapped/forward keys
        for (let key in pressedRemapKeys) {
            if (pressedRemapKeys[key]) {
                delete pressedRemapKeys[key];
                const parts = key.split('-');
                if (parts.length === 2) {
                    const actId = parts[0];
                    const clientIndex = parseInt(parts[1], 10);
                    const act = activeActions.find(a => a.id === actId);
                    const page = clientPages[clientIndex];
                    if (act && page) {
                        page.keyboard.up(act.targetKey || '5').catch(e => {});
                    }
                }
            }
        }
        // Clear all forward hold timers
        for (let key in forwardHoldTimers) {
            if (forwardHoldTimers[key]) {
                clearTimeout(forwardHoldTimers[key]);
                delete forwardHoldTimers[key];
            }
        }
    }
    
    sendOverlayUpdate();
    return global.isSuspended;
};

function syncOverlayProcess(enableOverlay) {
    if (!isSystemInitialized) return; // Delay overlay launch until system initialization is complete

    if (enableOverlay) {
        if (overlayProcess) return; // Already running

        console.log(`[Overlay] Starting Python Desktop Overlay...`);
        const overlayPath = path.join(__dirname, 'overlay.py');
        
        // Spawn Python subprocess with stdin piped, ignoring stdout/stderr to reduce log clutter
        overlayProcess = spawn('python', ['-u', overlayPath], {
            stdio: ['pipe', 'ignore', 'ignore'],
            detached: true,
            windowsHide: true
        });

        overlayProcess.on('error', (err) => {
            overlayProcess = spawn('py', ['-u', overlayPath], { stdio: ['pipe', 'ignore', 'ignore'], detached: true, windowsHide: true });
            
            overlayProcess.on('error', (err2) => {
                overlayProcess = spawn('python3', ['-u', overlayPath], { stdio: ['pipe', 'ignore', 'ignore'], detached: true, windowsHide: true });
                
                overlayProcess.on('error', (err3) => {
                    console.error(`[Overlay Error] Python is not installed or not available in the system PATH.`);
                    overlayProcess = null;
                });
            });
        });

        if (overlayProcess) {
            overlayProcess.unref();
            
            overlayProcess.on('close', () => {
                console.log(`[Overlay] Desktop Overlay process closed.`);
                overlayProcess = null;
            });

            // Send initial state update
            setTimeout(sendOverlayUpdate, 300);
        }
    } else {
        if (overlayProcess) {
            console.log(`[Overlay] Stopping Desktop Overlay...`);
            overlayProcess.kill('SIGINT');
            overlayProcess = null;
        }
    }
}

// Clean up subprocess on main process exit
process.on('exit', () => {
    if (overlayProcess) {
        overlayProcess.kill();
    }
});

function updateBrowserTitles() {
    for (let index of activeClients) {
        const page = clientPages[index];
        if (!page) continue;
        const alias = clientAliases[String(index)] || '';
        const prefix = alias ? `[${alias}] ` : `[Client ${index}] `;
        
        page.evaluate(({ prefix }) => {
            window.__clientPrefix = prefix;
            const title = document.title;
            let cleanTitle = title;
            if (cleanTitle && cleanTitle.includes('] ')) {
                const parts = cleanTitle.split('] ');
                if (parts.length > 1 && parts[0].startsWith('[')) {
                    cleanTitle = parts.slice(1).join('] ');
                }
            }
            document.title = prefix + cleanTitle;
        }, { prefix }).catch(e => {
            // Ignore errors for closed tabs
        });
    }
}

// ============================================================================
// BROWSER LAUNCHER & SELECTION PROMPTS
// ============================================================================
function parseClientInput(input) {
    const clients = [];
    const parts = input.split(',');
    for (let part of parts) {
        part = part.trim();
        if (part.includes('-')) {
            const rangeParts = part.split('-');
            const start = parseInt(rangeParts[0], 10);
            const end = parseInt(rangeParts[1], 10);
            if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 8 && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (!clients.includes(i)) clients.push(i);
                }
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num >= 1 && num <= 8) {
                if (!clients.includes(num)) clients.push(num);
            }
        }
    }
    return clients.sort((a, b) => a - b);
}

function askClientsAndBrowser() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("=================================================");
    console.log("Enter active client numbers to run (1-8):");
    console.log("Example: '2,4' for Client 2 & 4, or '1-3' for Clients 1 to 3.");
    console.log("Press Enter without input to run Client 1.");
    console.log("=================================================");

    return new Promise((resolve) => {
        rl.question("Enter clients and press Enter: ", (clientAnswer) => {
            const input = clientAnswer.trim();
            let parsedClients = [];
            if (input === '') {
                parsedClients = [1];
            } else {
                parsedClients = parseClientInput(input);
            }
            if (parsedClients.length === 0) {
                console.log("⚠️ No valid client numbers detected! Running Client 1 by default.");
                parsedClients = [1];
            }

            console.log(`\nSelected clients to launch: [${parsedClients.join(', ')}]`);

            console.log("\n=================================================");
            console.log("Please select browser to run:");
            console.log(" [1] Google Chrome");
            console.log(" [2] Microsoft Edge");
            console.log(" [3] Mozilla Firefox");
            console.log("=================================================");

            rl.question("Enter number (1, 2 or 3) and press Enter: ", (browserAnswer) => {
                rl.close();
                const browserChoice = browserAnswer.trim();
                let choice = '1';
                if (browserChoice === '1' || browserChoice === '2' || browserChoice === '3') {
                    choice = browserChoice;
                } else {
                    console.log("⚠️ Invalid choice! Opening Google Chrome by default.");
                }
                resolve({ activeClientsList: parsedClients, choice });
            });
        });
    });
}

function isBlankPage(p) {
    const url = p.url();
    return url === 'about:blank' || url === '' ||
        url.includes('chrome://newtab') || url.includes('chrome-search://') ||
        url.includes('edge://newtab') || url.includes('edge://new-tab-page') ||
        url.includes('ntp.msn.com/edge/ntp') || url.includes('about:newtab');
}

function migrateProfilesDirectory() {
    const projectPath = __dirname;
    const profilesDir = path.join(projectPath, 'profiles');
    if (!fs.existsSync(profilesDir)) {
        try {
            fs.mkdirSync(profilesDir, { recursive: true });
        } catch (e) {
            console.error(`[System Error] Failed to create profiles directory:`, e.message);
            return;
        }
    }

    const oldProfiles = [
        'chrome-profile', 'chrome-profile-2',
        'edge-profile', 'edge-profile-2',
        'firefox-profile', 'firefox-profile-2'
    ];

    for (const name of oldProfiles) {
        const oldPath = path.join(projectPath, name);
        const newPath = path.join(profilesDir, name);
        if (fs.existsSync(oldPath)) {
            if (!fs.existsSync(newPath)) {
                try {
                    fs.renameSync(oldPath, newPath);
                    console.log(`[System] Cleaned up folder structure: Moved old profile "${name}" to "profiles/${name}"`);
                } catch (e) {
                    console.warn(`[System] Failed to move old profile folder "${name}":`, e.message);
                }
            }
        }
    }
}

async function launchBrowser(activeClientsList, choice) {
    activeClients = activeClientsList;
    global.activeClients = activeClients; // Share with test-server.js

    const projectPath = __dirname;
    const profilesDir = path.join(projectPath, 'profiles');

    let launchOptions = {
        headless: false,
        viewport: null,
        args: [
            // === Window & Display ===
            '--start-maximized',
            '--disable-infobars',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-blink-features=AutomationControlled',

            // === Background Throttling Prevention ===
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',

            // === GPU & Rendering Performance ===
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            '--ignore-gpu-blocklist',
            '--disable-gpu-process-crash-limit',

            // === Reduce CPU/Memory Overhead ===
            '--disable-extensions',
            '--disable-sync',
            '--disable-default-apps',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-translate',

            // === Telemetry / Noise ===
            '--metrics-recording-only',
            '--disable-breakpad',

            // === Process Management ===
            '--renderer-process-limit=1'
        ]
    };

    let startUrl = targetUrlKeyword;
    if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
        if (startUrl.includes('localhost') || startUrl.includes('127.0.0.1')) {
            startUrl = 'http://' + startUrl;
        } else {
            startUrl = 'https://' + startUrl;
        }
    }

    let browserName = '';
    let browserType = chromium;

    if (choice === '1') {
        browserName = 'Google Chrome';
        browserType = chromium;
    } else if (choice === '2') {
        browserName = 'Microsoft Edge';
        browserType = chromium;
    } else {
        browserName = 'Mozilla Firefox';
        browserType = firefox;
    }

    const channelVal = choice === '1' ? 'chrome' : (choice === '2' ? 'msedge' : undefined);
    const controlPanelUrl = 'http://localhost:3000/';

    // Launch all selected clients
    for (let clientIndex of activeClients) {
        console.log(`[System] Launching Client ${clientIndex} (${browserName}) with persistent context...`);

        let profileName = '';
        if (choice === '1') {
            profileName = clientIndex === 1 ? 'chrome-profile' : `chrome-profile-${clientIndex}`;
        } else if (choice === '2') {
            profileName = clientIndex === 1 ? 'edge-profile' : `edge-profile-${clientIndex}`;
        } else {
            profileName = clientIndex === 1 ? 'firefox-profile' : `firefox-profile-${clientIndex}`;
        }

        const profilePath = path.join(profilesDir, profileName);
        const launchArgs = { ...launchOptions };
        if (channelVal) launchArgs.channel = channelVal;

        // Apply custom User-Agent if defined in clientUserAgents configuration
        const customUa = clientUserAgents[String(clientIndex)];
        if (customUa && customUa.trim() !== '') {
            console.log(`[System] [Client ${clientIndex}] Setting custom User-Agent: "${customUa}"`);
            launchArgs.userAgent = customUa.trim();
        }
        
        // Firefox specific args & user prefs
        if (choice === '3') {
            launchArgs.args = ['-start-maximized'];

            // Firefox performance prefs (equivalent to about:config tweaks)
            launchArgs.firefoxUserPrefs = {
                // === Disable Telemetry & Background Services ===
                'toolkit.telemetry.enabled': false,
                'toolkit.telemetry.unified': false,
                'toolkit.telemetry.server': '',
                'datareporting.healthreport.uploadEnabled': false,
                'datareporting.policy.dataSubmissionEnabled': false,
                'app.shield.optoutstudies.enabled': false,
                'browser.ping-centre.telemetry': false,
                'browser.newtabpage.activity-stream.feeds.telemetry': false,
                'browser.newtabpage.activity-stream.telemetry': false,

                // === Disable Sync & Accounts ===
                'identity.fxaccounts.enabled': false,
                'services.sync.enabled': false,

                // === Disable First-Run & Welcome Pages ===
                'browser.startup.firstrunSkipsHomepage': true,
                'browser.startup.homepage_override.mstone': 'ignore',
                'startup.homepage_welcome_url': '',
                'browser.laterrun.enabled': false,
                'browser.uitour.enabled': false,

                // === GPU & Hardware Acceleration ===
                'gfx.webrender.enabled': true,
                'gfx.webrender.all': true,
                'layers.acceleration.enabled': true,
                'layers.gpu-process.enabled': true,
                'layers.omtp.enabled': true,
                'media.hardware-video-decoding.enabled': true,

                // === Disable Background Networking ===
                'network.prefetch-next': false,
                'network.dns.disablePrefetch': true,
                'network.http.speculative-parallel-limit': 0,
                'browser.safebrowsing.malware.enabled': false,
                'browser.safebrowsing.phishing.enabled': false,

                // === Reduce UI Overhead ===
                'browser.tabs.animate': false,
                'browser.fullscreen.animate': false,
                'ui.prefersReducedMotion': 1,
                'accessibility.force_disabled': 1,

                // === Smooth Scrolling ===
                'general.smoothScroll': true,
                'mousewheel.min_line_scroll_amount': 5,

                // === Session & Crash Reporting ===
                'browser.sessionstore.resume_from_crash': false,
                'browser.crashReports.unsubmittedCheck.enabled': false,

                // === Prevent Mouse Back/Forward History Navigation ===
                'mousebutton.4th.enabled': false,
                'mousebutton.5th.enabled': false
            };

            // Firefox persistent path logic
            if (clientIndex === 1) {
                launchArgs.profile = path.join(profilePath, 'playwright-nightly');
            }
        }

        const browserCtx = await browserType.launchPersistentContext(profilePath, launchArgs);
        clientContexts[clientIndex] = browserCtx;

        const pages = browserCtx.pages();
        const targetPage = pages.find(p => p.url().includes(targetUrlKeyword));
        const controlPanelPage = pages.find(p => p.url().includes('localhost:3000'));
        const blankPages = pages.filter(p => isBlankPage(p));

        let usedPages = [];
        if (targetPage) usedPages.push(targetPage);
        if (controlPanelPage) usedPages.push(controlPanelPage);

        // 1. Open target game page
        let pageForTarget = targetPage;
        if (!pageForTarget) {
            const availableBlank = blankPages.find(p => !usedPages.includes(p));
            if (availableBlank) {
                pageForTarget = availableBlank;
                usedPages.push(availableBlank);
                console.log(`[System] Client ${clientIndex}: Navigating existing blank tab to game URL: ${startUrl}`);
                pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} initial navigation error:`, e.message));
            } else {
                console.log(`[System] Client ${clientIndex}: Creating new tab for game URL: ${startUrl}`);
                pageForTarget = await browserCtx.newPage();
                usedPages.push(pageForTarget);
                pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} initial navigation error:`, e.message));
            }
        }

        // 2. Open control panel tab on Client 1 only
        if (clientIndex === 1 && !startUrl.includes('localhost:3000') && !controlPanelPage) {
            const availableBlank = blankPages.find(p => !usedPages.includes(p));
            if (availableBlank) {
                console.log(`[System] Client 1: Reusing existing blank tab for control panel`);
                availableBlank.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
            } else {
                console.log(`[System] Client 1: Opening new tab for control panel: ${controlPanelUrl}`);
                if (pageForTarget) {
                    await pageForTarget.evaluate((url) => {
                        window.open(url, '_blank');
                    }, controlPanelUrl).catch(async (err) => {
                        console.log(`[System] Client 1 window.open failed, falling back to newPage():`, err.message);
                        const cpPage = await browserCtx.newPage();
                        cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
                    });
                } else {
                    const cpPage = await browserCtx.newPage();
                    cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
                }
            }
        } else if (clientIndex === 1 && controlPanelPage) {
            console.log(`[System] Client 1 already has control panel open: "${controlPanelPage.url()}"`);
        }

        // 3. Add Webdriver evasion and dynamic title observer
        await browserCtx.addInitScript(({ index, initialPrefix }) => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Prevent mouse back/forward buttons (Mouse 4 and Mouse 5) from navigating away from the page
            const preventMouseNav = (e) => {
                if (e.button === 3 || e.button === 4) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            window.addEventListener('mousedown', preventMouseNav, true);
            window.addEventListener('mouseup', preventMouseNav, true);
            window.addEventListener('click', preventMouseNav, true);
            
            window.__clientPrefix = initialPrefix;
            
            const updateTitle = () => {
                const prefix = window.__clientPrefix || `[Client ${index}] `;
                const title = document.title;
                if (title && !title.startsWith(prefix)) {
                    let cleanTitle = title;
                    if (title.includes('] ')) {
                        const parts = title.split('] ');
                        if (parts[0].startsWith('[')) {
                            cleanTitle = parts.slice(1).join('] ');
                        }
                    }
                    document.title = prefix + cleanTitle;
                }
            };

            const observer = new MutationObserver(updateTitle);
            observer.observe(document.querySelector('title') || document.documentElement, {
                subtree: true,
                characterData: true,
                childList: true
            });
            updateTitle();
        }, { index: clientIndex, initialPrefix: clientAliases[String(clientIndex)] ? `[${clientAliases[String(clientIndex)]}] ` : `[Client ${clientIndex}] ` });
    }

    console.log(`[System] ${browserName} launcher completed successfully!`);
}

function resetAndRescanClient(clientIndex, browserCtx) {
    const page = clientPages[clientIndex];
    if (page) {
        try {
            page.removeAllListeners('close');
            page.removeAllListeners('crash');
        } catch (e) {}
    }
    clientPages[clientIndex] = null;
    stopLoopsForClient(clientIndex);
    findAndAttachTabForClient(clientIndex, browserCtx).catch(err => console.error(`Error in tab search for Client ${clientIndex}:`, err));
}

// Scanning for the target tab periodically until found
async function findAndAttachTabForClient(clientIndex, browserCtx) {
    console.log(`[System] 🔍 [Client ${clientIndex}] Scanning for tabs containing "${targetUrlKeyword}"...`);
    
    while (true) {
        try {
            const pages = browserCtx.pages();
            const foundPage = pages.find(p => {
                const url = p.url();
                if (url.includes(targetUrlKeyword) || (url.includes('game') && !url.includes('localhost:3000'))) {
                    return true;
                }
                if (targetUrlKeyword.includes('localhost:3000') && url.includes('localhost:3000')) {
                    return true;
                }
                return false;
            });

            if (foundPage) {
                clientPages[clientIndex] = foundPage;
                console.log(`\n[System] ✅ [Client ${clientIndex}] Game tab detected! Target locked: "${await foundPage.title()}"`);

                foundPage.on('close', () => {
                    console.log(`\n⚠️ [System] [Client ${clientIndex}] Game tab closed! Pausing actions for Client ${clientIndex} and scanning again...`);
                    resetAndRescanClient(clientIndex, browserCtx);
                });

                foundPage.on('crash', () => {
                    console.log(`\n⚠️ [System] [Client ${clientIndex}] Game tab crashed! Pausing actions for Client ${clientIndex} and scanning again...`);
                    resetAndRescanClient(clientIndex, browserCtx);
                });

                console.log(`-------------------------------------------------`);
                console.log(`[Client ${clientIndex}] Global Hotkeys initialized!`);
                console.log(`-------------------------------------------------\n`);
                updateBrowserTitles();
                // Start ghost mouse jitter for this client if enabled
                startGhostMouseJitter(clientIndex);
                break;
            }
        } catch (e) {
            // Silence page retrieval errors during transition
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

// ============================================================================
// GHOST MOUSE JITTER
// ============================================================================
function startGhostMouseJitter(clientIndex) {
    stopGhostMouseJitter(clientIndex); // Clear any existing timer first
    if (!ghostMouseJitterConfig.enabled) return;

    const page = clientPages[clientIndex];
    if (!page) return;

    const scheduleNext = () => {
        const { intervalMin, intervalMax, maxOffset } = ghostMouseJitterConfig;
        const delay = intervalMin + Math.random() * (intervalMax - intervalMin);

        ghostMouseJitterTimers[clientIndex] = setTimeout(async () => {
            // Re-check if still enabled and page is still valid
            if (!ghostMouseJitterConfig.enabled) return;
            const currentPage = clientPages[clientIndex];
            if (!currentPage) return;

            try {
                // Get viewport size or use safe default
                const viewportSize = currentPage.viewportSize() || { width: 1280, height: 720 };
                const centerX = viewportSize.width / 2;
                const centerY = viewportSize.height / 2;

                // Random small offset from center
                const dx = (Math.random() - 0.5) * 2 * maxOffset;
                const dy = (Math.random() - 0.5) * 2 * maxOffset;

                await currentPage.mouse.move(centerX + dx, centerY + dy, { steps: 3 });
            } catch (e) {
                // Page may have navigated or closed — silently skip
            }

            scheduleNext();
        }, delay);
    };

    scheduleNext();
    console.log(`[Ghost Mouse] Started for Client ${clientIndex} (interval: ${ghostMouseJitterConfig.intervalMin}-${ghostMouseJitterConfig.intervalMax}ms, offset: ±${ghostMouseJitterConfig.maxOffset}px)`);
}

function stopGhostMouseJitter(clientIndex) {
    if (ghostMouseJitterTimers[clientIndex]) {
        clearTimeout(ghostMouseJitterTimers[clientIndex]);
        delete ghostMouseJitterTimers[clientIndex];
    }
}

function syncGhostMouseJitter() {
    // Called on config reload — start or stop for all active clients
    for (let clientIndex of activeClients) {
        if (ghostMouseJitterConfig.enabled && clientPages[clientIndex]) {
            startGhostMouseJitter(clientIndex);
        } else {
            stopGhostMouseJitter(clientIndex);
        }
    }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================
async function initSystem() {
    try {
        migrateProfilesDirectory();
        
        const { activeClientsList, choice } = await askClientsAndBrowser();
        await launchBrowser(activeClientsList, choice);
        sendOverlayUpdate();

        console.log("=================================================");
        console.log("[System] Bot attached to browser context successfully!");
        console.log("=================================================");

        const scanPromises = activeClients.map(index => 
            findAndAttachTabForClient(index, clientContexts[index])
        );
        await Promise.all(scanPromises);

        // Start native mouse and keyboard listeners after initialization completes
        startGlobalListeners();

        isSystemInitialized = true;
        // Sync overlay process after system is fully initialized
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed.profiles && parsed.activeProfile) {
                const profile = parsed.profiles[parsed.activeProfile];
                if (profile) {
                    syncOverlayProcess(!!profile.enableOverlay);
                }
            }
        }

    } catch (error) {
        console.error("\n❌ [System Error] Initialization failed!");
        console.error(" >>", error.message);
        console.log("\n[System] Bot exiting due to startup failure.");
        process.exit(1);
    }
}

// ============================================================================
// ACTION & LOOP FUNCTIONS
// ============================================================================
async function sendKey(action, key) {
    const target = action.targetClient || '1';
    const targets = getActionTargets(target);

    if (targets.length > 1) {
        // Sequentially send to all targets in the list
        for (let targetIdxStr of targets) {
            await sendKey({ ...action, targetClient: targetIdxStr }, key);
        }
        return;
    }

    const targetIdx = parseInt(targets[0], 10);
    const targetPage = clientPages[targetIdx];
    const clientName = `Client ${targetIdx}`;

    if (!targetPage) return;

    if (isBuffSequenceRunning[String(targetIdx)] && action.mode === 'loop') {
        return; // Skip loops if buff sequence is running on this client
    }

    try {
        // 1. Add random pre-press delay for human-like timing (10 - 35ms)
        const jitterDelay = Math.floor(Math.random() * 25) + 10;
        await new Promise(res => setTimeout(res, jitterDelay));

        // 2. Simulate hold time (60 - 130ms) like a human
        const holdTime = Math.floor(Math.random() * 70) + 60;
        await targetPage.keyboard.press(key, { delay: holdTime });

        console.log(`[Action] [${clientName}] Sent key: "${key}" (Delay: ${jitterDelay}ms | Hold: ${holdTime}ms)`);
    } catch (e) {
        console.error(`[Action Error] [${clientName}] Failed to send key "${key}":`, e.message);

        // Detect closed connection / target destroyed / browser crash
        const msg = e.message.toLowerCase();
        if (msg.includes('closed') || msg.includes('target') || msg.includes('session') || msg.includes('detached') || msg.includes('destroyed')) {
            console.log(`\n⚠️ [System] [${clientName}] Game tab connection lost during action execution! Initiating rescan...`);
            resetAndRescanClient(targetIdx, clientContexts[targetIdx]);
        }
    }
}

// Ensure running loops match the activeActions list
function syncRunningLoops() {
    for (let actionId in activeLoopStates) {
        if (activeLoopStates[actionId].running) {
            const matchingAct = activeActions.find(a => a.id === actionId && a.enabled);
            if (!matchingAct || matchingAct.mode !== 'loop') {
                stopLoopAction(actionId, matchingAct ? matchingAct.name : actionId);
            }
        }
    }
}

// Start a loop action
async function startLoopAction(action, callStack) {
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    for (let t of targets) {
        if (isBuffSequenceRunning[String(t)]) {
            console.log(`⚠️ Cannot start loop: Buff Sequence is currently running on Client ${t}`);
            return;
        }
    }

    console.log(`🟢 [Action] Starting loop: "${action.name}" on Client ${target}`);
    if (!activeLoopStates[action.id]) {
        activeLoopStates[action.id] = { running: true, timeout: null };
    } else {
        activeLoopStates[action.id].running = true;
    }

    await fireChain(action, 'onBeforeStart', callStack);
    await fireChain(action, 'onStart', callStack);

    // Run first steps if any
    if (action.firstSteps && action.firstSteps.length > 0) {
        console.log(` - Running first steps for "${action.name}"...`);
        for (let step of action.firstSteps) {
            if (!activeLoopStates[action.id] || !activeLoopStates[action.id].running) return;
            await sendKey(action, step.key);
            await new Promise(res => setTimeout(res, step.delay));
        }
    }

    await fireChain(action, 'onAfterStart', callStack);

    // Start the interval loop
    runLoopStep(action);
    sendOverlayUpdate();
}

// Stop a loop action
function stopLoopAction(actionId, actionName) {
    if (activeLoopStates[actionId]) {
        console.log(`🔴 [Action] Stopped: "${actionName}"`);
        activeLoopStates[actionId].running = false;
        if (activeLoopStates[actionId].timeout) {
            clearTimeout(activeLoopStates[actionId].timeout);
            activeLoopStates[actionId].timeout = null;
        }
        const act = activeActions.find(a => a.id === actionId);
        if (act) fireChain(act, 'onStop');
        sendOverlayUpdate();
    }
}

// Stop all running loops
function stopAllLoops() {
    for (let act of activeActions) {
        if (act.mode === 'loop') {
            stopLoopAction(act.id, act.name);
        }
    }
}

// Stop active loops for a specific client
function stopLoopsForClient(clientIndex) {
    for (let act of activeActions) {
        if (act.mode === 'loop') {
            const targets = getActionTargets(act.targetClient).map(x => parseInt(x, 10));
            if (targets.includes(clientIndex)) {
                stopLoopAction(act.id, act.name);
            }
        }
    }
}

// Inner execution step for loops
async function runLoopStep(action, callStack) {
    const state = activeLoopStates[action.id];
    if (!state || !state.running) return;

    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            if (!state || !state.running) return;
            await sendKey(action, key);
        }
    }

    await fireChain(action, 'onEachCycle', callStack);

    const baseInterval = action.interval || 3000;
    const jitterMax = action.jitter || 0;
    let nextInterval = baseInterval;

    if (jitterMax > 0) {
        const jitter = Math.floor(Math.random() * (jitterMax * 2)) - jitterMax;
        nextInterval = Math.max(100, baseInterval + jitter);
    }

    state.timeout = setTimeout(() => runLoopStep(action, callStack), nextInterval);
}

// Run buff sequence
async function runBuffSequenceAction(action, callStack) {
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    for (let t of targets) {
        isBuffSequenceRunning[String(t)] = true;
        console.log(`🔵 [Action] Buff Sequence Started: "${action.name}" on Client ${t}...`);
        stopLoopsForClient(t);
    }
    await fireChain(action, 'onBeforeStart', callStack);
    await fireChain(action, 'onStart', callStack);
    await fireChain(action, 'onAfterStart', callStack);
    sendOverlayUpdate();

    const delay = action.delayBuff || 800;
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(action, key);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    for (let t of targets) {
        isBuffSequenceRunning[String(t)] = false;
        console.log(`⚪ [Action] Finished Buff Sequence: "${action.name}" on Client ${t}`);
    }
    if (action.delayAfter && action.delayAfter > 0) {
        console.log(` - Waiting delayAfter: ${action.delayAfter}ms...`);
        await new Promise(res => setTimeout(res, action.delayAfter));
    }
    await fireChain(action, 'onComplete', callStack);
    sendOverlayUpdate();
}

// Run single press
async function runSinglePressAction(action, callStack) {
    const target = action.targetClient || '1';
    console.log(`⚡ [Action] Single Press: "${action.name}" on Client ${target}`);
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(action, key);
        }
    }
    if (action.delayAfter && action.delayAfter > 0) {
        console.log(` - Waiting delayAfter: ${action.delayAfter}ms...`);
        await new Promise(res => setTimeout(res, action.delayAfter));
    }
    await fireChain(action, 'onFired', callStack);
}

async function toggleKeyHoldAction(action, callStack) {
    const targetKey = action.targetKey || '1';
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    const isCurrentlyHeld = !!activeHoldStates[action.id];
    const nextState = !isCurrentlyHeld;
    activeHoldStates[action.id] = nextState;

    console.log(`⚓ [Action] Toggle Key Hold for "${action.name}" (${targetKey}) on Client ${target} ➜ ${nextState ? 'DOWN' : 'UP'}`);

    for (let t of targets) {
        const page = clientPages[t];
        if (!page) continue;
        
        try {
            if (nextState) {
                await page.keyboard.down(targetKey);
            } else {
                await page.keyboard.up(targetKey);
            }
        } catch (e) {
            console.error(`[Action Error] Failed toggle key hold on Client ${t}:`, e.message);
        }
    }

    fireChain(action, nextState ? 'onEnable' : 'onDisable', callStack);
    sendOverlayUpdate();
}

// Unified trigger entry point
function handleActionTrigger(act) {
    if (act.mode === 'loop') {
        const state = activeLoopStates[act.id];
        if (state && state.running) {
            stopLoopAction(act.id, act.name);
        } else {
            startLoopAction(act).catch(err => console.error(`Error in startLoopAction:`, err));
        }
    } else if (act.mode === 'buff_sequence') {
        const target = act.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));

        // Only start if not already running on any of the target clients
        let alreadyRunning = false;
        for (let t of targets) {
            if (isBuffSequenceRunning[String(t)]) {
                alreadyRunning = true;
                break;
            }
        }

        if (!alreadyRunning) {
            runBuffSequenceAction(act).catch(err => console.error(`Error in runBuffSequence:`, err));
        }
    } else if (act.mode === 'single_press') {
        runSinglePressAction(act).catch(err => console.error(`Error in runSinglePress:`, err));
    } else if (act.mode === 'key_hold') {
        toggleKeyHoldAction(act).catch(err => console.error(`Error in toggleKeyHoldAction:`, err));
    } else if (act.mode === 'action_control') {
        runActionControl(act).catch(err => console.error(`Error in runActionControl:`, err));
    }
}

// ============================================================================
// ACTION CHAIN (Trigger forwarding between Actions)
// ============================================================================

// Fire chained actions for a given source action and event name.
// callStack prevents infinite loops (A→B→A).
async function fireChain(sourceAction, eventName, callStack = new Set()) {
    const chains = sourceAction.chaining;
    if (!chains || chains._enabled !== true) return; // Chain disabled globally unless explicitly true
    if (!chains[eventName] || !chains[eventName].length) return;

    const stackKey = `${sourceAction.id}:${eventName}`;
    if (callStack.has(stackKey)) {
        console.warn(`[Chain] ⚠️ Circular chain detected: "${sourceAction.name}" → ${eventName} — skipping.`);
        return;
    }
    callStack.add(stackKey);

    for (const targetId of chains[eventName]) {
        const targetAction = activeActions.find(a => a.id === targetId && a.enabled);
        if (!targetAction) {
            console.warn(`[Chain] Target action "${targetId}" not found or disabled — skipping.`);
            continue;
        }
        console.log(`[Chain] "${sourceAction.name}" [${eventName}] → "${targetAction.name}"`);
        await runChainedAction(targetAction, callStack);
    }
}

// Run a target action directly (bypasses hotkey requirement).
async function runChainedAction(action, callStack) {
    if (action.mode === 'loop') {
        const state = activeLoopStates[action.id];
        if (state && state.running) {
            stopLoopAction(action.id, action.name);
        } else {
            await startLoopAction(action, callStack).catch(err => console.error(`[Chain Error] startLoopAction:`, err));
        }
    } else if (action.mode === 'buff_sequence') {
        const target = action.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));
        let alreadyRunning = targets.some(t => isBuffSequenceRunning[String(t)]);
        if (!alreadyRunning) {
            await runBuffSequenceAction(action, callStack).catch(err => console.error(`[Chain Error] runBuffSequenceAction:`, err));
        }
    } else if (action.mode === 'single_press') {
        await runSinglePressAction(action, callStack).catch(err => console.error(`[Chain Error] runSinglePressAction:`, err));
    } else if (action.mode === 'key_hold') {
        await toggleKeyHoldAction(action, callStack).catch(err => console.error(`[Chain Error] toggleKeyHoldAction:`, err));
    } else if (action.mode === 'action_control') {
        await runActionControl(action, callStack).catch(err => console.error(`[Chain Error] runActionControl:`, err));
    }
}

async function runActionControl(act, callStack) {
    const targetIds = act.controlTargetIds || (act.controlTargetId ? [act.controlTargetId] : []);
    const op = act.controlOperation || 'toggle';
    if (!targetIds.length) return;

    // Prevent circular execution stacks within the control command chain
    const stackKey = `${act.id}:control`;
    const resolvedStack = callStack || new Set();
    if (resolvedStack.has(stackKey)) {
        console.warn(`[Action Control] ⚠️ Circular control loop detected: "${act.name}" control stack — skipping.`);
        return;
    }
    resolvedStack.add(stackKey);

    for (const targetId of targetIds) {
        const targetAction = activeActions.find(a => a.id === targetId);
        if (!targetAction || !targetAction.enabled) {
            console.log(`[Action Control] Target action "${targetId}" is missing or disabled — skipping.`);
            continue;
        }

        console.log(`[Action Control] Sourced from "${act.name}": Controlling "${targetAction.name}" (Operation: ${op})`);

        if (targetAction.mode === 'loop') {
            const state = activeLoopStates[targetAction.id];
            const isRunning = state && state.running;
            if (op === 'start') {
                if (!isRunning) await startLoopAction(targetAction, resolvedStack).catch(e => console.error(e));
            } else if (op === 'stop') {
                if (isRunning) stopLoopAction(targetAction.id, targetAction.name);
            } else { // toggle
                if (isRunning) stopLoopAction(targetAction.id, targetAction.name);
                else await startLoopAction(targetAction, resolvedStack).catch(e => console.error(e));
            }
        } else if (targetAction.mode === 'key_hold') {
            const isCurrentlyHeld = !!activeHoldStates[targetAction.id];
            if (op === 'start') {
                if (!isCurrentlyHeld) await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
            } else if (op === 'stop') {
                if (isCurrentlyHeld) await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
            } else { // toggle
                await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
            }
        } else if (targetAction.mode === 'buff_sequence') {
            const target = targetAction.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));
            let alreadyRunning = targets.some(t => isBuffSequenceRunning[String(t)]);
            if (op === 'start' || op === 'toggle') {
                if (!alreadyRunning) {
                    await runBuffSequenceAction(targetAction, resolvedStack).catch(err => console.error(err));
                }
            }
        } else if (targetAction.mode === 'single_press') {
            if (op === 'start' || op === 'toggle') {
                await runSinglePressAction(targetAction, resolvedStack).catch(err => console.error(err));
            }
        } else if (targetAction.mode === 'action_control') {
            await runActionControl(targetAction, resolvedStack).catch(err => console.error(err));
        }
    }
}

// ============================================================================
// GLOBAL HOTKEYS LISTENER (Native OS level hooks)
// ============================================================================

function startGlobalListeners() {
    console.log("\n[System] Initializing global keyboard and mouse listeners...");
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    mouseEvents = require('global-mouse-events');
    keyboard = new GlobalKeyboardListener();

    // 1. Mouse Button Events Hook
    mouseEvents.on('mousedown', (event) => {
        if (global.isSuspended) return;

        const hasAttachedPage = Object.values(clientPages).some(p => p !== null && p !== undefined);
        if (!hasAttachedPage) return;

        // Find matching actions
        const matchingActions = activeActions.filter(act =>
            act.enabled &&
            act.trigger.type === 'mouse' &&
            act.trigger.value == event.button
        );

        for (let act of matchingActions) {
            console.log(`[Global Mouse Captured] Triggered action: "${act.name}" via Mouse Button ${event.button}`);
            handleActionTrigger(act);
        }
    });

    // 2. Keyboard Events Hook
    keyboard.addListener(function (e, down) {
        const isDown = e.state === "DOWN";
        const isUp = e.state === "UP";
        if (!isDown && !isUp) return;

        // Handle global suspend hotkey toggle
        if (isDown && suspendHotkey && e.name && e.name.toUpperCase() === suspendHotkey.toUpperCase()) {
            global.toggleSuspendState();
            return;
        }

        if (global.isSuspended) return;

        const hasAttachedPage = Object.values(clientPages).some(p => p !== null && p !== undefined);
        if (!hasAttachedPage) return;

        // 1. Handle normal actions (loop, buff_sequence, single_press) strictly on DOWN state
        if (isDown) {
            const matchingActions = activeActions.filter(act =>
                act.enabled &&
                act.mode !== 'forward' &&
                act.trigger.type === 'keyboard' &&
                act.trigger.type !== 'none' &&
                act.trigger.value &&
                act.trigger.value.toUpperCase() === e.name.toUpperCase()
            );

            if (matchingActions.length > 0) {
                console.log(`[Global Key Captured] Triggered key: "${e.name}"`);
            }

            for (let act of matchingActions) {
                handleActionTrigger(act);
            }
        }

        // 2. Handle forward actions (down and up states for holding keys)
        const forwardActions = activeActions.filter(act =>
            act.enabled &&
            act.mode === 'forward' &&
            act.trigger.type === 'keyboard' &&
            act.trigger.value &&
            act.trigger.value.toUpperCase() === e.name.toUpperCase()
        );

        for (let act of forwardActions) {
            const targetKey = act.targetKey || '5';
            const target = act.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));

            for (let clientIndex of targets) {
                const page = clientPages[clientIndex];
                if (!page) continue;

                const trackingKey = `${act.id}-${clientIndex}`;
                if (isDown) {
                    if (!pressedRemapKeys[trackingKey] && !forwardHoldTimers[trackingKey]) {
                        if (act.delayActivation) {
                            const delay = act.activationDelayMs !== undefined ? parseInt(act.activationDelayMs, 10) : 1000;
                            forwardHoldTimers[trackingKey] = setTimeout(() => {
                                pressedRemapKeys[trackingKey] = true;
                                delete forwardHoldTimers[trackingKey];
                                console.log(`[Forward] [Client ${clientIndex}] Key Down (Delayed): "${targetKey}" (via Physical Key "${e.name}")`);
                                page.keyboard.down(targetKey).catch(err => {
                                    console.error(`[Forward Error] [Client ${clientIndex}] Failed keyboard.down("${targetKey}"):`, err.message);
                                });
                                // Fire onActivated chain once (only on the first client to avoid duplicate)
                                if (clientIndex === targets[0]) fireChain(act, 'onActivated');
                                sendOverlayUpdate();
                            }, delay);
                            // Fire onKeyDown immediately
                            if (clientIndex === targets[0]) fireChain(act, 'onKeyDown');
                        } else {
                            pressedRemapKeys[trackingKey] = true;
                            console.log(`[Forward] [Client ${clientIndex}] Key Down: "${targetKey}" (via Physical Key "${e.name}")`);
                            page.keyboard.down(targetKey).catch(err => {
                                console.error(`[Forward Error] [Client ${clientIndex}] Failed keyboard.down("${targetKey}"):`, err.message);
                            });
                            // Fire onKeyDown AND onActivated together (no delay)
                            if (clientIndex === targets[0]) {
                                fireChain(act, 'onKeyDown');
                                fireChain(act, 'onActivated');
                            }
                            sendOverlayUpdate();
                        }
                    }
                } else if (isUp) {
                    if (forwardHoldTimers[trackingKey]) {
                        clearTimeout(forwardHoldTimers[trackingKey]);
                        delete forwardHoldTimers[trackingKey];
                    }
                    if (pressedRemapKeys[trackingKey]) {
                        delete pressedRemapKeys[trackingKey];
                        console.log(`[Forward] [Client ${clientIndex}] Key Up: "${targetKey}" (via Physical Key "${e.name}")`);
                        page.keyboard.up(targetKey).catch(err => {
                            console.error(`[Forward Error] [Client ${clientIndex}] Failed keyboard.up("${targetKey}"):`, err.message);
                        });
                        if (clientIndex === targets[0]) fireChain(act, 'onKeyUp');
                        // For delayed-activation actions: give overlay 120ms to render ⚡ before going back to Standby.
                        if (act.delayActivation) {
                            setTimeout(() => sendOverlayUpdate(), 120);
                        } else {
                            sendOverlayUpdate();
                        }
                    }
                }
            }
        }
    });

    console.log("[System] Global keyboard and mouse listeners initialized successfully!");
}

// Start system initialization
initSystem();
