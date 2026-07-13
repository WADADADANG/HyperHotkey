const { chromium, firefox } = require('playwright');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Start the control panel server
require('./test-server.js');

let keyboard, mouseEvents;
let browserContext1, page1;
let browserContext2, page2;
let operationMode = 'single'; // 'single' or 'dual'

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
                activeActions = [];
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
// Storage for randomized timeout references (Dynamic Jitter) per action ID
let activeLoopStates = {};
let isBuffSequenceRunning = { '1': false, '2': false };

// ============================================================================
// BROWSER LAUNCHER & SELECTION PROMPTS
// ============================================================================
function askOperationModeAndBrowser() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("=================================================");
    console.log("Please select Operation Mode:");
    console.log(" [1] Single Client (1 Game Account)");
    console.log(" [2] Dual Clients (2 Game Accounts)");
    console.log("=================================================");

    return new Promise((resolve) => {
        rl.question("Enter number (1 or 2): ", (modeAnswer) => {
            const modeChoice = modeAnswer.trim();
            const mode = (modeChoice === '2') ? 'dual' : 'single';
            
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
                resolve({ mode, choice });
            });
        });
    });
}

function isBlankPage(p) {
    const url = p.url();
    return url === 'about:blank' || url === '' || url.includes('chrome://newtab') || url.includes('chrome-search://');
}

async function launchBrowser(mode, choice) {
    operationMode = mode;
    const projectPath = __dirname;
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
    
    // Launch Client 1
    let profilePath1 = '';
    if (choice === '1') profilePath1 = path.join(projectPath, 'chrome-profile');
    else if (choice === '2') profilePath1 = path.join(projectPath, 'edge-profile');
    else profilePath1 = path.join(projectPath, 'firefox-profile', 'playwright-nightly');

    console.log(`[System] Launching Client 1 (${browserName}) with persistent context...`);
    const launchArgs1 = { ...launchOptions };
    if (channelVal) launchArgs1.channel = channelVal;
    if (choice === '3') {
        launchArgs1.args = [
            '-start-maximized',
            '-disable-background-timer-throttling',
            '-disable-backgrounding-occluded-windows'
        ];
    }
    browserContext1 = await browserType.launchPersistentContext(profilePath1, launchArgs1);

    const pages1 = browserContext1.pages();
    const targetPage1 = pages1.find(p => p.url().includes(targetUrlKeyword));
    const controlPanelPage1 = pages1.find(p => p.url().includes('localhost:3000'));
    const blankPages1 = pages1.filter(p => isBlankPage(p));
    
    let usedPages1 = [];
    if (targetPage1) usedPages1.push(targetPage1);
    if (controlPanelPage1) usedPages1.push(controlPanelPage1);

    // Navigate or open target game page for Client 1
    let pageForTarget1 = targetPage1;
    if (!pageForTarget1) {
        const availableBlank = blankPages1.find(p => !usedPages1.includes(p));
        if (availableBlank) {
            pageForTarget1 = availableBlank;
            usedPages1.push(availableBlank);
            console.log(`[System] Client 1: Navigating existing blank tab to game URL: ${startUrl}`);
            pageForTarget1.goto(startUrl).catch(e => console.log(`[System] Client 1 initial navigation error:`, e.message));
        } else {
            console.log(`[System] Client 1: Creating new tab for game URL: ${startUrl}`);
            pageForTarget1 = await browserContext1.newPage();
            usedPages1.push(pageForTarget1);
            pageForTarget1.goto(startUrl).catch(e => console.log(`[System] Client 1 initial navigation error:`, e.message));
        }
    }

    // Open control panel tab on Client 1
    if (!startUrl.includes('localhost:3000') && !controlPanelPage1) {
        const availableBlank = blankPages1.find(p => !usedPages1.includes(p));
        if (availableBlank) {
            console.log(`[System] Client 1: Reusing existing blank tab for control panel`);
            availableBlank.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
        } else {
            console.log(`[System] Client 1: Opening new tab for control panel: ${controlPanelUrl}`);
            if (pageForTarget1) {
                await pageForTarget1.evaluate((url) => {
                    window.open(url, '_blank');
                }, controlPanelUrl).catch(async (err) => {
                    console.log(`[System] Client 1 window.open failed, falling back to newPage():`, err.message);
                    const cpPage = await browserContext1.newPage();
                    cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
                });
            } else {
                const cpPage = await browserContext1.newPage();
                cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
            }
        }
    } else if (controlPanelPage1) {
        console.log(`[System] Client 1 already has control panel open: "${controlPanelPage1.url()}"`);
    }

    await browserContext1.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Launch Client 2
    if (mode === 'dual') {
        let profilePath2 = '';
        if (choice === '1') profilePath2 = path.join(projectPath, 'chrome-profile-2');
        else if (choice === '2') profilePath2 = path.join(projectPath, 'edge-profile-2');
        else profilePath2 = path.join(projectPath, 'firefox-profile-2');

        console.log(`[System] Launching Client 2 (${browserName}) with persistent context...`);
        const launchArgs2 = { ...launchOptions };
        if (channelVal) launchArgs2.channel = channelVal;
        if (choice === '3') {
            launchArgs2.args = [
                '-start-maximized',
                '-disable-background-timer-throttling',
                '-disable-backgrounding-occluded-windows'
            ];
        }
        browserContext2 = await browserType.launchPersistentContext(profilePath2, launchArgs2);

        const pages2 = browserContext2.pages();
        const targetPage2 = pages2.find(p => p.url().includes(targetUrlKeyword));
        const blankPages2 = pages2.filter(p => isBlankPage(p));
        
        let usedPages2 = [];
        if (targetPage2) usedPages2.push(targetPage2);

        // Navigate or open target game page for Client 2
        let pageForTarget2 = targetPage2;
        if (!pageForTarget2) {
            const availableBlank = blankPages2.find(p => !usedPages2.includes(p));
            if (availableBlank) {
                pageForTarget2 = availableBlank;
                usedPages2.push(availableBlank);
                console.log(`[System] Client 2: Navigating existing blank tab to game URL: ${startUrl}`);
                pageForTarget2.goto(startUrl).catch(e => console.log(`[System] Client 2 initial navigation error:`, e.message));
            } else {
                console.log(`[System] Client 2: Creating new tab for game URL: ${startUrl}`);
                pageForTarget2 = await browserContext2.newPage();
                usedPages2.push(pageForTarget2);
                pageForTarget2.goto(startUrl).catch(e => console.log(`[System] Client 2 initial navigation error:`, e.message));
            }
        }

        await browserContext2.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
    }

    console.log(`[System] ${browserName} launcher completed successfully!`);
}

function resetAndRescanClient(clientIndex, browserCtx) {
    if (clientIndex === 1) {
        if (page1) {
            try {
                page1.removeAllListeners('close');
                page1.removeAllListeners('crash');
            } catch (e) {}
        }
        page1 = null;
        stopLoopsForClient(1);
        findAndAttachTabForClient(1, browserCtx).catch(err => console.error("Error in tab search for Client 1:", err));
    } else {
        if (page2) {
            try {
                page2.removeAllListeners('close');
                page2.removeAllListeners('crash');
            } catch (e) {}
        }
        page2 = null;
        stopLoopsForClient(2);
        findAndAttachTabForClient(2, browserCtx).catch(err => console.error("Error in tab search for Client 2:", err));
    }
}

async function updateOverlayUIForClient(clientIndex, targetPage) {
    if (!targetPage) return;
    try {
        const runningNames = [];
        for (let act of activeActions) {
            const target = act.targetClient || '1';
            if (target === String(clientIndex) || target === 'both') {
                if (act.mode === 'loop' && activeLoopStates[act.id] && activeLoopStates[act.id].running) {
                    runningNames.push(`🟢 ${act.name}`);
                }
            }
        }
        if (isBuffSequenceRunning[String(clientIndex)]) {
            const buffAct = activeActions.find(a => a.mode === 'buff_sequence');
            if (buffAct) {
                const target = buffAct.targetClient || '1';
                if (target === String(clientIndex) || target === 'both') {
                    runningNames.push(`🔵 ${buffAct.name}...`);
                }
            }
        }

        const listHtml = runningNames.length > 0
            ? runningNames.map(name => `<div style="font-weight:600;color:#10b981;margin-bottom:2px;">${name}</div>`).join('')
            : `<div style="color:#a1a1aa;">💤 Standby</div>`;

        await targetPage.evaluate((html) => {
            const statusDiv = document.getElementById('bot-overlay-status');
            if (statusDiv) statusDiv.innerHTML = html;
        }, listHtml);
    } catch (e) {
        // Ignore page connection drops
    }
}

async function updateOverlayUI() {
    if (operationMode === 'dual') {
        await updateOverlayUIForClient(1, page1);
        await updateOverlayUIForClient(2, page2);
    } else {
        await updateOverlayUIForClient(1, page1);
    }
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
                if (clientIndex === 1) {
                    page1 = foundPage;
                } else {
                    page2 = foundPage;
                }
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
                break;
            }
        } catch (e) {
            // Silence page retrieval errors during transition
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================
async function initSystem() {
    try {
        const { mode, choice } = await askOperationModeAndBrowser();
        await launchBrowser(mode, choice);

        console.log("=================================================");
        console.log("[System] Bot attached to browser context successfully!");
        console.log("=================================================");

        if (mode === 'dual') {
            await Promise.all([
                findAndAttachTabForClient(1, browserContext1),
                findAndAttachTabForClient(2, browserContext2)
            ]);
        } else {
            await findAndAttachTabForClient(1, browserContext1);
        }

        // Start native mouse and keyboard listeners after initialization completes
        startGlobalListeners();

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
    let targetPage = page1;
    let clientName = 'Client 1';

    if (target === '2') {
        targetPage = page2;
        clientName = 'Client 2';
    } else if (target === 'both') {
        // Sequentially send to both if marked as both
        await sendKey({ ...action, targetClient: '1' }, key);
        await sendKey({ ...action, targetClient: '2' }, key);
        return;
    }

    if (!targetPage) return;

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
            if (target === '2') {
                resetAndRescanClient(2, browserContext2);
            } else {
                resetAndRescanClient(1, browserContext1);
            }
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
async function startLoopAction(action) {
    const target = action.targetClient || '1';
    if (isBuffSequenceRunning[target]) return;

    console.log(`🟢 [Action] Starting loop: "${action.name}" on Client ${target}`);
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
            await sendKey(action, step.key);
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

// Stop active loops for a specific client
function stopLoopsForClient(clientIndex) {
    for (let act of activeActions) {
        const target = act.targetClient || '1';
        if ((target === String(clientIndex) || target === 'both') && act.mode === 'loop') {
            stopLoopAction(act.id, act.name);
        }
    }
}

// Inner execution step for loops
async function runLoopStep(action) {
    const target = action.targetClient || '1';
    const state = activeLoopStates[action.id];
    if (!state || !state.running || isBuffSequenceRunning[target]) return;

    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            if (!state || !state.running || isBuffSequenceRunning[target]) return;
            await sendKey(action, key);
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
    const target = action.targetClient || '1';
    isBuffSequenceRunning[target] = true;
    console.log(`🔵 [Action] Buff Sequence Started: "${action.name}" on Client ${target}...`);

    // Stop active loop actions for this client first
    stopLoopsForClient(target);

    const delay = action.delayBuff || 800;
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(action, key);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    isBuffSequenceRunning[target] = false;
    console.log(`⚪ [Action] Finished Buff Sequence: "${action.name}" on Client ${target}`);
}

// Run single press
async function runSinglePressAction(action) {
    const target = action.targetClient || '1';
    console.log(`⚡ [Action] Single Press: "${action.name}" on Client ${target}`);
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(action, key);
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
        const target = act.targetClient || '1';
        if (!isBuffSequenceRunning[target]) {
            runBuffSequenceAction(act).catch(err => console.error(`Error in runBuffSequence:`, err));
        }
    } else if (act.mode === 'single_press') {
        runSinglePressAction(act).catch(err => console.error(`Error in runSinglePress:`, err));
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
        console.log(`[Global Mouse Captured] Clicked button: ${event.button}`);
        if (!page1 && !page2) return;

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
        if (!page1 && !page2) return;

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

    console.log("[System] Global keyboard and mouse listeners initialized successfully!");
}

// Start system initialization
initSystem();
