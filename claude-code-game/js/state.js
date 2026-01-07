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
    // oneOff: true means task disappears after completion
    tasks: [
        { id: 'prototype', name: 'Claude Code Prototype', progress: 0, clicksNeeded: 50, oneOff: true }
    ],

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
        vibeMode: false
    },

    // Timing
    lastTick: Date.now(),
    tickRate: 1000
};

export function hasUpgrade(id) {
    return gameState.upgrades.includes(id) || gameState.declinedUpgrades.includes(id);
}
