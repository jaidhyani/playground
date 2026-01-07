/**
 * Game State - Central state object for Universal Paperclaudes
 * You're an engineer at Anthropic working on Claude Code
 */

export const gameState = {
    // Core resources
    resources: {
        energy: 100,       // Focus/motivation (0-100). Goes to 0 = burnout
        codebase: 0,       // Quality/size of Claude Code
        techDebt: 0,       // Accumulated shortcuts (slows future work)
        trust: 50          // Internal autonomy (0-100). Affects what you can do
    },

    // PR queue - vibe coding generates PRs that need review
    prQueue: [],

    // Coding progress - manual coding requires multiple clicks
    codingProgress: 0,
    codingClicksNeeded: 20,  // Takes effort - makes vibe coding feel valuable

    // Focus area (chosen early game)
    focus: null,  // 'mcp', 'agents', 'evals', 'infra'

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
