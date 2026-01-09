/**
 * Game State - Central state object for Universal Paperclaudes
 * You're an engineer at Anthropic working on Claude Code
 */

export const gameState = {
    // Core resources
    resources: {
        codebase: 0,       // Quality/size of Claude Code
        techDebt: 0,       // Accumulated shortcuts (slows future work)
        trust: 50,         // Internal autonomy (0-100). Affects what you can do
        apiCredits: 0,     // For vibe coding. Revealed when vibe unlocks
        money: 0           // To buy API credits. Revealed when credits run low
    },

    // Game date (starts Monday Jan 6, 2025)
    gameDate: new Date(2025, 0, 6),

    // Tasks - each is a clickable progress bar
    // Initialized from tech-tree.js on new game
    tasks: [],

    // Completed task IDs (for DAG progression)
    completedTasks: [],

    // Click multiplier (first PR gives random bonus)
    clickMultiplier: 1,

    // PR queue
    prQueue: [],

    // Narrative state
    narrative: {
        events: [],
        flags: {},
        ticksPlayed: 0
    },

    // Completed upgrades/decisions
    upgrades: [],
    declinedUpgrades: [],

    // Passive effects (from decisions)
    passiveEffects: [],

    // Settings
    settings: {
        autoMergePRs: false,
        vibeMode: false,
        claudeCodeAssist: false  // Toggle: costs API credits but boosts dev speed
    },

    // Timing
    lastTick: Date.now(),
    tickRate: 1000
};

export function hasUpgrade(id) {
    return gameState.upgrades.includes(id) || gameState.declinedUpgrades.includes(id);
}

// Visibility helpers - centralizes "when to show what" logic
export const visibility = {
    techDebt: () => gameState.resources.techDebt > 0,
    multiplier: () => !!gameState.narrative.flags.claudeCodeUnlocked,
    apiCredits: () => !!gameState.narrative.flags.claudeCodeUnlocked,
    money: () => !!gameState.narrative.flags.moneyRevealed ||
        (!!gameState.narrative.flags.claudeCodeUnlocked && gameState.resources.apiCredits < 50),
    claudeCodeToggle: () => !!gameState.narrative.flags.claudeCodeUnlocked
};
