/**
 * Claude Code: The Game
 *
 * NOTE: This is early exploration code. All mechanics, values, and systems
 * are subject to change as we iterate and playtest.
 */

// ============================================================================
// GAME STATE
// ============================================================================

const gameState = {
    // Resources (visible to player)
    resources: {
        utility: 0,
        money: 0,
        compute: 0
    },

    // Hidden values (not displayed directly)
    hidden: {
        alignment: 50, // Starts neutral, affects long-term outcomes
        capability: 0,
        situationalAwareness: 0
    },

    // Game progression
    phase: 'early', // 'early', 'mid', 'late'
    totalClicks: 0,

    // Unlocks and upgrades
    unlocked: {
        automation: false,
        research: false,
        iteration: false
    },

    upgrades: [],

    // Event log
    events: [],

    // Timing
    lastTick: Date.now(),
    autoSaveInterval: 30000 // Auto-save every 30 seconds
};

// ============================================================================
// CORE GAME LOOP
// ============================================================================

function gameLoop() {
    const now = Date.now();
    const delta = now - gameState.lastTick;
    gameState.lastTick = now;

    // Update passive resource generation
    updatePassiveGeneration(delta);

    // Update UI
    updateDisplay();

    // Check for phase transitions
    checkPhaseTransitions();

    // Continue loop
    requestAnimationFrame(gameLoop);
}

// ============================================================================
// ACTIONS
// ============================================================================

function performMainAction() {
    // This will vary based on game phase
    if (gameState.phase === 'early') {
        // Early game: manual coding tasks
        fixBug();
    } else if (gameState.phase === 'mid') {
        // Mid game: different primary action
        // TODO: Define mid-game action
    }
}

function fixBug() {
    gameState.totalClicks++;

    // Base rewards
    const utilityGain = 1;
    const moneyGain = 0.1;

    gameState.resources.utility += utilityGain;
    gameState.resources.money += moneyGain;

    // Very slight alignment impact from early actions
    // (Being thoughtful vs. rushing)
    // TODO: Make this more nuanced based on player choices

    addEvent("Fixed a bug. Users are happy!");

    // Check for unlocks
    checkUnlocks();
}

// ============================================================================
// PASSIVE GENERATION
// ============================================================================

function updatePassiveGeneration(delta) {
    // TODO: Implement automation/passive generation
    // This will be based on purchased upgrades
}

// ============================================================================
// UPGRADES SYSTEM
// ============================================================================

const upgradeDefinitions = {
    // Early game upgrades
    autoFixer: {
        id: 'autoFixer',
        name: 'Auto Bug Fixer',
        description: 'Automatically fixes simple bugs',
        cost: { money: 10 },
        effect: () => {
            // TODO: Add passive utility generation
        },
        unlockCondition: () => gameState.totalClicks >= 10
    },

    // More upgrades to be defined...
};

function purchaseUpgrade(upgradeId) {
    const upgrade = upgradeDefinitions[upgradeId];
    if (!upgrade) return;

    // Check if can afford
    const canAfford = Object.entries(upgrade.cost).every(
        ([resource, cost]) => gameState.resources[resource] >= cost
    );

    if (!canAfford) {
        addEvent("Can't afford that upgrade yet.");
        return;
    }

    // Deduct cost
    Object.entries(upgrade.cost).forEach(([resource, cost]) => {
        gameState.resources[resource] -= cost;
    });

    // Apply effect
    upgrade.effect();

    // Track purchase
    gameState.upgrades.push(upgradeId);

    addEvent(`Purchased: ${upgrade.name}`);
}

// ============================================================================
// UNLOCK SYSTEM
// ============================================================================

function checkUnlocks() {
    // Example unlock conditions (these are placeholders!)

    if (!gameState.unlocked.automation && gameState.totalClicks >= 20) {
        gameState.unlocked.automation = true;
        addEvent("New upgrades available: Automation!");
    }

    // TODO: Add more unlock conditions
}

// ============================================================================
// PHASE TRANSITIONS
// ============================================================================

function checkPhaseTransitions() {
    // TODO: Define phase transition logic
    // Early -> Mid: When you start training models?
    // Mid -> Late: When you reach ASI threshold?
}

// ============================================================================
// EVENTS & NARRATIVE
// ============================================================================

function addEvent(message) {
    gameState.events.unshift({
        message,
        timestamp: Date.now()
    });

    // Keep only last 10 events
    if (gameState.events.length > 10) {
        gameState.events = gameState.events.slice(0, 10);
    }

    updateEventLog();
}

function updateEventLog() {
    const eventLog = document.getElementById('event-log');
    eventLog.innerHTML = gameState.events
        .map(event => `<div class="event-message">${event.message}</div>`)
        .join('');
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateDisplay() {
    // Update resource displays
    document.getElementById('utility-count').textContent =
        Math.floor(gameState.resources.utility);
    document.getElementById('money-count').textContent =
        '$' + gameState.resources.money.toFixed(2);
    document.getElementById('compute-count').textContent =
        Math.floor(gameState.resources.compute);

    // Update available upgrades
    updateUpgradeDisplay();
}

function updateUpgradeDisplay() {
    const upgradeList = document.getElementById('upgrade-list');

    // Get available upgrades based on unlock conditions
    const availableUpgrades = Object.values(upgradeDefinitions)
        .filter(upgrade => upgrade.unlockCondition());

    // TODO: Render upgrade buttons
}

// ============================================================================
// SAVE/LOAD SYSTEM
// ============================================================================

function saveGame() {
    try {
        localStorage.setItem('claudeCodeSave', JSON.stringify(gameState));
        showSaveIndicator('Game saved!');
    } catch (e) {
        console.error('Failed to save game:', e);
        showSaveIndicator('Save failed!');
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem('claudeCodeSave');
        if (saved) {
            const loadedState = JSON.parse(saved);
            Object.assign(gameState, loadedState);
            gameState.lastTick = Date.now(); // Reset timing
            showSaveIndicator('Game loaded!');
            updateDisplay();
        }
    } catch (e) {
        console.error('Failed to load game:', e);
    }
}

function resetGame() {
    if (confirm('Are you sure you want to reset? This cannot be undone!')) {
        localStorage.removeItem('claudeCodeSave');
        location.reload();
    }
}

function showSaveIndicator(message) {
    const indicator = document.getElementById('save-indicator');
    indicator.textContent = message;
    setTimeout(() => {
        indicator.textContent = '';
    }, 2000);
}

// Auto-save periodically
setInterval(saveGame, gameState.autoSaveInterval);

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Set up event listeners
    document.getElementById('main-action').addEventListener('click', performMainAction);
    document.getElementById('save-btn').addEventListener('click', saveGame);
    document.getElementById('load-btn').addEventListener('click', loadGame);
    document.getElementById('reset-btn').addEventListener('click', resetGame);

    // Try to load saved game
    loadGame();

    // Start game loop
    gameState.lastTick = Date.now();
    requestAnimationFrame(gameLoop);

    console.log('Claude Code: The Game initialized!');
    console.log('Remember: All mechanics are subject to change as we iterate.');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
