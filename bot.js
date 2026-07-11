const { chromium, firefox } = require('playwright');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const mouseEvents = require('global-mouse-events');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Start the control panel server
require('./test-server.js');

const keyboard = new GlobalKeyboardListener();
let browserContext, page;

// ============================================================================
// CONFIGURATION VARIABLES
// ============================================================================
let targetUrlKeyword = 'universe.flyff.com'; // URL keyword to identify game tab

let activeActions = [];

// Helper to load config from JSON file
function loadConfigFromFile() {
    try {
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

            // Load actions array
            if (profile.actions && Array.isArray(profile.actions)) {
                activeActions = profile.actions;
            } else {
                // Backward compatibility conversion if they had old structure
                activeActions = [];
                if (profile.HealingLoop && profile.HealingLoop.key) {
                    activeActions.push({
                        id: "action_1",
                        name: "Healing Loop",
                        mode: "loop",
                        trigger: { type: "keyboard", value: "F9" },
                        keys: [profile.HealingLoop.key],
                        interval: profile.HealingLoop.interval || 3000,
                        jitter: 250,
                        firstSteps: profile.FirstStep || [],
                        enabled: true
                    });
                }
                if (profile.MiniHealingLoop && profile.MiniHealingLoop.key) {
                    activeActions.push({
                        id: "action_2",
                        name: "Mini Healing Loop",
                        mode: "loop",
                        trigger: { type: "keyboard", value: "F10" },
                        keys: [profile.MiniHealingLoop.key],
                        interval: profile.MiniHealingLoop.interval || 1500,
                        jitter: 150,
                        firstSteps: [],
                        enabled: true
                    });
                }
                if (profile.BetweenHealing1 && profile.BetweenHealing1.key) {
                    activeActions.push({
                        id: "action_3",
                        name: "Between Healing Loop",
                        mode: "loop",
                        trigger: { type: "keyboard", value: "F8" },
                        keys: [profile.BetweenHealing1.key],
                        interval: profile.BetweenHealing1.interval || 40000,
                        jitter: 2000,
                        firstSteps: [],
                        enabled: true
                    });
                }
                if (profile.buttonBuffs && profile.buttonBuffs.length > 0) {
                    activeActions.push({
                        id: "action_4",
                        name: "Buff Sequence",
                        mode: "buff_sequence",
                        trigger: { type: "keyboard", value: "INSERT" },
                        keys: profile.buttonBuffs,
                        delayBuff: profile.DelayBuff || 800,
                        enabled: true
                    });
                }
            }

            // Sync state of active loops
            syncRunningLoops();

            console.log(`[Config] Loaded ${activeActions.length} actions successfully!`);
        } else {
            console.log("[Config Error] config.json does not exist. Creating defaults...");
            // Create default multi-profile file if missing
            const defaults = {
                activeProfile: "Default",
                profiles: {
                    Default: {
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
                                enabled: true
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
                                enabled: true
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
                                enabled: true
                            },
                            {
                                id: "action_4",
                                name: "Buff Sequence",
                                mode: "buff_sequence",
                                trigger: { type: "keyboard", value: "INSERT" },
                                keys: ["F3", "1", "2", "3", "4", "5", "6", "7", "F4", "1", "2", "3", "4", "5", "F1"],
                                delayBuff: 800,
                                enabled: true
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
let isHealing = false;
let isMiniHealing = false;
let isBuff = false;

// Storage for randomized timeout references (Dynamic Jitter)
let healingTimeout = null;
let miniHealingTimeout = null;
let between1Timeout = null;

// ============================================================================
// BROWSER LAUNCHER & SELECTION PROMPT
// ============================================================================
function askBrowserSelection() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("=================================================");
    console.log("Please select browser to run the game:");
    console.log(" [1] Google Chrome");
    console.log(" [2] Microsoft Edge");
    console.log(" [3] Mozilla Firefox");
    console.log("=================================================");

    return new Promise((resolve) => {
        rl.question("Enter number (1, 2 or 3) and press Enter: ", (answer) => {
            rl.close();
            const choice = answer.trim();
            if (choice === '1' || choice === '2' || choice === '3') {
                resolve(choice);
            } else {
                console.log("⚠️ Invalid choice! Opening Google Chrome by default.");
                resolve('1');
            }
        });
    });
}

async function launchBrowser(choice) {
    const projectPath = __dirname;
    let profilePath = '';
    let launchOptions = {
        headless: false,
        viewport: null,
        args: [
            '--start-maximized',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--renderer-process-limit=1'
        ]
    };

    let browserName = '';

    if (choice === '1') {
        browserName = 'Google Chrome';
        profilePath = path.join(projectPath, 'chrome-profile');
        console.log(`[System] Launching ${browserName} with persistent context...`);
        browserContext = await chromium.launchPersistentContext(profilePath, {
            ...launchOptions,
            channel: 'chrome'
        });
    } else if (choice === '2') {
        browserName = 'Microsoft Edge';
        profilePath = path.join(projectPath, 'edge-profile');
        console.log(`[System] Launching ${browserName} with persistent context...`);
        browserContext = await chromium.launchPersistentContext(profilePath, {
            ...launchOptions,
            channel: 'msedge'
        });
    } else {
        browserName = 'Mozilla Firefox';
        profilePath = path.join(projectPath, 'firefox-profile', 'playwright-nightly');
        console.log(`[System] Launching ${browserName} with persistent context...`);
        browserContext = await firefox.launchPersistentContext(profilePath, {
            headless: false,
            viewport: null,
            args: [
                '-start-maximized',
                '-disable-background-timer-throttling',
                '-disable-backgrounding-occluded-windows'
            ]
        });
    }

    // Open a blank page initially if none are open
    const pages = browserContext.pages();
    if (pages.length === 0) {
        await browserContext.newPage();
    }

    // Hide Playwright automation flags (navigator.webdriver) to prevent detection
    await browserContext.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });

    console.log(`[System] ${browserName} launched successfully!`);
}

function resetAndRescan() {
    if (page) {
        try {
            page.removeAllListeners('close');
            page.removeAllListeners('crash');
        } catch (e) { }
    }
    page = null;
    stopAllLoops();
    findAndAttachTab().catch(err => console.error("Error in tab search:", err));
}

async function updateOverlayUI() {
    if (!page) return;
    try {
        const runningNames = [];
        for (let act of activeActions) {
            if (act.mode === 'loop' && activeLoopStates[act.id] && activeLoopStates[act.id].running) {
                runningNames.push(`🟢 ${act.name}`);
            }
        }
        if (isBuffSequenceRunning) {
            const buffAct = activeActions.find(a => a.mode === 'buff_sequence');
            runningNames.push(`🔵 ${buffAct ? buffAct.name : 'Buff Sequence'}...`);
        }

        const listHtml = runningNames.length > 0
            ? runningNames.map(name => `<div style="font-weight:600;color:#10b981;margin-bottom:2px;">${name}</div>`).join('')
            : `<div style="color:#a1a1aa;">💤 Standby</div>`;

        await page.evaluate((html) => {
            const statusDiv = document.getElementById('bot-overlay-status');
            if (statusDiv) statusDiv.innerHTML = html;
        }, listHtml);
    } catch (e) {
        // Ignore page connection drops
    }
}

// Scanning for the target tab periodically until found
async function findAndAttachTab() {
    console.log(`[System] 🔍 Scanning for tabs containing "${targetUrlKeyword}"...`);
    console.log("[System] (Please open your game page or local test page in the launched browser)");

    while (true) {
        try {
            const pages = browserContext.pages();
            const foundPage = pages.find(p => p.url().includes(targetUrlKeyword) || p.url().includes('localhost:3000') || p.url().includes('game'));

            if (foundPage) {
                page = foundPage;
                console.log(`\n[System] ✅ Game tab detected! Target locked: "${await page.title()}"`);

                // Track tab closure to reset and poll again
                page.on('close', () => {
                    console.log("\n⚠️ [System] Game tab closed! Pausing bot and scanning for tab again...");
                    resetAndRescan();
                });

                page.on('crash', () => {
                    console.log("\n⚠️ [System] Game tab crashed! Pausing bot and scanning for tab again...");
                    resetAndRescan();
                });

                console.log("-------------------------------------------------");
                console.log("Global Hotkeys (Ready to use):");
                console.log(" - XBUTTON1 or MOUSE BACK or [F9]  : Toggle Healing Mode");
                console.log(" - XBUTTON2 or MOUSE FORWARD or [F10]: Toggle Mini Healing Mode");
                console.log(" - INSERT or [HOME]                 : Trigger Buff Sequence");
                console.log("-------------------------------------------------\n");
                break;
            }
        } catch (e) {
            // Silence page retrieval errors during transition or browser shutdown
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================
async function initSystem() {
    try {
        const choice = await askBrowserSelection();
        await launchBrowser(choice);

        console.log("=================================================");
        console.log("[System] Bot attached to browser context successfully!");
        console.log("=================================================");

        await findAndAttachTab();

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
async function sendKey(key) {
    if (!page) return;
    try {
        // 1. Add random pre-press delay for human-like timing (10 - 35ms)
        const jitterDelay = Math.floor(Math.random() * 25) + 10;
        await new Promise(res => setTimeout(res, jitterDelay));

        // 2. Simulate hold time (60 - 130ms) like a human
        const holdTime = Math.floor(Math.random() * 70) + 60;
        await page.keyboard.press(key, { delay: holdTime });

        console.log(`[Action] Sent key: "${key}" (Delay: ${jitterDelay}ms | Hold: ${holdTime}ms)`);
    } catch (e) {
        console.error(`[Action Error] Failed to send key "${key}":`, e.message);

        // Detect closed connection / target destroyed / browser crash
        const msg = e.message.toLowerCase();
        if (msg.includes('closed') || msg.includes('target') || msg.includes('session') || msg.includes('detached') || msg.includes('destroyed')) {
            console.log("\n⚠️ [System] Game tab connection lost during action execution! Initiating rescan...");
            resetAndRescan();
        }
    }
}

// Storage for running action state
let activeLoopStates = {};
let isBuffSequenceRunning = false;

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
async function startLoopAction(action) {
    if (isBuffSequenceRunning) return;

    console.log(`🟢 [Action] Starting loop: "${action.name}"`);
    if (!activeLoopStates[action.id]) {
        activeLoopStates[action.id] = { running: true, timeout: null };
    } else {
        activeLoopStates[action.id].running = true;
    }

    // Run first steps if any
    if (action.firstSteps && action.firstSteps.length > 0) {
        console.log(` - Running first steps for "${action.name}"...`);
        for (let step of action.firstSteps) {
            if (!activeLoopStates[action.id] || !activeLoopStates[action.id].running) return;
            await sendKey(step.key);
            await new Promise(res => setTimeout(res, step.delay));
        }
    }

    // Start the interval loop
    runLoopStep(action);
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

// Inner execution step for loops
async function runLoopStep(action) {
    const state = activeLoopStates[action.id];
    if (!state || !state.running || isBuffSequenceRunning) return;

    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            if (!state || !state.running || isBuffSequenceRunning) return;
            await sendKey(key);
        }
    }

    const baseInterval = action.interval || 3000;
    const jitterMax = action.jitter || 0;
    let nextInterval = baseInterval;

    if (jitterMax > 0) {
        const jitter = Math.floor(Math.random() * (jitterMax * 2)) - jitterMax;
        nextInterval = Math.max(100, baseInterval + jitter);
    }

    state.timeout = setTimeout(() => runLoopStep(action), nextInterval);
}

// Run buff sequence
async function runBuffSequenceAction(action) {
    isBuffSequenceRunning = true;
    console.log(`🔵 [Action] Buff Sequence Started: "${action.name}"...`);

    // Stop all active loop actions first
    stopAllLoops();

    const delay = action.delayBuff || 800;
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(key);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    isBuffSequenceRunning = false;
    console.log(`⚪ [Action] Finished Buff Sequence: "${action.name}"`);
}

// Run single press
async function runSinglePressAction(action) {
    console.log(`⚡ [Action] Single Press: "${action.name}"`);
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(key);
        }
    }
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
        if (!isBuffSequenceRunning) {
            runBuffSequenceAction(act).catch(err => console.error(`Error in runBuffSequence:`, err));
        }
    } else if (act.mode === 'single_press') {
        runSinglePressAction(act).catch(err => console.error(`Error in runSinglePress:`, err));
    }
}

// ============================================================================
// GLOBAL HOTKEYS LISTENER (Native OS level hooks)
// ============================================================================

// 1. Mouse Button Events Hook
mouseEvents.on('mousedown', (event) => {
    console.log(`[Global Mouse Captured] Clicked button: ${event.button}`);
    if (!page) return;

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
    if (e.state !== "DOWN") return;
    if (!page) return;

    // Find matching actions
    const matchingActions = activeActions.filter(act =>
        act.enabled &&
        act.trigger.type === 'keyboard' &&
        act.trigger.value &&
        act.trigger.value.toUpperCase() === e.name.toUpperCase()
    );

    if (matchingActions.length > 0) {
        console.log(`[Global Key Captured] Triggered key: "${e.name}"`);
    }

    for (let act of matchingActions) {
        handleActionTrigger(act);
    }
});

// Start system initialization
initSystem();
