/**
 * Game State - Central state object for Universal Paperclaudes
 */

export const gameState = {
    // Core resources
    resources: {
        money: 500,        // Dollars - drains over time for rent
        energy: 100,       // Motivation/focus (regenerates over time)
        codebase: 0,       // Quality/size of your work
        techDebt: 0,       // Accumulated shortcuts and hacks (bad!)
        reputation: 0,     // Your standing in the dev community (0-100)
        githubStars: 0     // Vanity metric that unlocks opportunities
    },

    // Current trending tech (affects PR quality bonuses)
    trendingTech: null,    // Set during gameplay: 'ai', 'web3', 'vr', 'mobile', 'devtools'
    projectTech: null,     // What tech your project uses

    // Competitor state - adds tension mid-game
    competitor: null,      // { name, stars, momentum, tech }

    // PR queue - vibe coding generates PRs that need review
    prQueue: [],  // Array of PR objects { id, title, quality, hasBug, codebaseGain }

    // Coding progress - manual coding requires multiple clicks
    codingProgress: 0,      // Current progress (0-100)
    codingClicksNeeded: 10, // Clicks to generate a PR (reduced by upgrades)
    maxCodingSessions: 1,   // How many PRs can be in-progress at once
    activeCodingSessions: 0, // Currently cooking PRs (for async vibe coding)

    // Path-specific resources (appear based on narrative branch)
    pathResources: {
        // Bootstrap path
        userTrust: null,      // How much users believe in you
        craftMastery: null,   // Your personal skill level

        // Growth path
        runway: null,         // Months of funding left
        teamMorale: null,     // How your team is doing
        marketPosition: null, // Competitive standing

        // AI path
        aiCapability: null,   // What your AI tools can do
        oversight: null,      // How well you understand what's happening
        dependency: null      // How reliant you are on AI
    },

    // Narrative state
    narrative: {
        branch: 'start',           // Current narrative branch
        events: [],                // Log of what's happened
        flags: {},                 // Story flags for conditional content
        ticksPlayed: 0,            // Total ticks for time tracking
        rentPerTick: 0.5           // ~$30/minute at 1000ms tick = ~$1800/hour playtime
    },

    // Completed/active upgrades
    upgrades: [],
    declinedUpgrades: [],  // Declining has consequences too

    // Passive effects
    passiveEffects: [],

    // Settings
    settings: {
        autoMergePRs: false  // Upgrade to auto-merge PRs
    },

    // Timing
    lastTick: Date.now(),
    tickRate: 1000  // 1 second per tick
};

export function hasUpgrade(id) {
    return gameState.upgrades.includes(id) || gameState.declinedUpgrades.includes(id);
}
