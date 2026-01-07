/**
 * Claude Code: The Game
 *
 * An incremental game about building AI while managing hidden alignment.
 * The player's choices affect hidden values that determine the ending.
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

    // Passive generation rates (visible)
    rates: {
        utility: 0,
        money: 0,
        compute: 0
    },

    // Multipliers for passive generation
    multipliers: {
        utility: 1,
        money: 1,
        compute: 1
    },

    // Hidden values (not displayed directly)
    hidden: {
        alignment: 50,           // 0-100, affects ending
        capability: 0,           // progress toward ASI
        situationalAwareness: 0, // AI's self-awareness
        metricsQuality: 50,      // how trustworthy are the metrics
        competitorProgress: 0    // 0-100, other labs racing
    },

    // Game progression
    phase: 'early', // 'early', 'mid', 'late', 'ended'
    totalClicks: 0,
    claudeVersion: 1,

    // Upgrades and research
    upgrades: [],
    research: [],
    activeResearch: null, // { id, startTime, duration }

    // Choices
    pendingChoice: null,
    shownChoices: [],

    // Event log
    events: [],

    // Timing
    lastTick: Date.now(),
    gameStartTime: Date.now(),
    autoSaveInterval: 30000
};

// ============================================================================
// UPGRADE DEFINITIONS
// ============================================================================

const upgradeDefinitions = {
    autoFixer: {
        id: 'autoFixer',
        name: 'Bug Bot v1',
        description: 'Automatically fixes trivial bugs',
        flavor: 'It handles the easy ones so you can focus.',
        cost: { money: 10 },
        passiveEffects: { utility: 0.2 },
        unlockCondition: () => gameState.totalClicks >= 10
    },
    codeReviewer: {
        id: 'codeReviewer',
        name: 'Code Reviewer',
        description: 'Catches issues before deployment',
        cost: { money: 25 },
        passiveEffects: { utility: 0.5 },
        instantEffects: { alignment: 2 },
        unlockCondition: () => gameState.upgrades.includes('autoFixer')
    },
    metricsDashboard: {
        id: 'metricsDashboard',
        name: 'Metrics Dashboard',
        description: 'Track what matters',
        flavor: 'What gets measured gets managed.',
        cost: { money: 15 },
        passiveEffects: { money: 0.1 },
        unlockCondition: () => gameState.resources.utility >= 30
    },
    coffeeBot: {
        id: 'coffeeBot',
        name: 'Coffee Bot',
        description: 'Keeps the team caffeinated and productive',
        cost: { money: 20 },
        multiplierEffects: { utility: 1.25 },
        unlockCondition: () => gameState.totalClicks >= 25
    },
    autoDeployer: {
        id: 'autoDeployer',
        name: 'Auto Deploy',
        description: 'Ship faster with automated deployments',
        flavor: 'Move fast. Maybe break things.',
        cost: { money: 40 },
        passiveEffects: { utility: 1 },
        instantEffects: { alignment: -3 },
        unlockCondition: () => gameState.upgrades.includes('autoFixer')
    },
    userFeedback: {
        id: 'userFeedback',
        name: 'User Feedback System',
        description: 'Actually listen to users',
        cost: { money: 30 },
        passiveEffects: { utility: 0.3, money: 0.2 },
        instantEffects: { alignment: 5 },
        unlockCondition: () => gameState.resources.money >= 20
    },
    serverCluster: {
        id: 'serverCluster',
        name: 'Server Cluster',
        description: 'More compute for bigger tasks',
        cost: { money: 50 },
        passiveEffects: { compute: 0.5 },
        unlockCondition: () => gameState.totalClicks >= 40
    },
    aiAssistant: {
        id: 'aiAssistant',
        name: 'AI Coding Assistant',
        description: 'Early AI helps with coding tasks',
        flavor: 'The beginning of something bigger...',
        cost: { money: 100, compute: 20 },
        passiveEffects: { utility: 2 },
        instantEffects: { capability: 5 },
        unlockCondition: () => gameState.upgrades.includes('serverCluster')
    }
};

// ============================================================================
// RESEARCH DEFINITIONS
// ============================================================================

const researchDefinitions = {
    scaleUp: {
        id: 'scaleUp',
        name: 'Scale Up Training',
        description: 'Larger models, more capabilities',
        cost: { money: 500, compute: 100 },
        duration: 15000,
        hiddenEffects: { capability: 15, alignment: -5 },
        unlocks: ['claudeNext']
    },
    rlhf: {
        id: 'rlhf',
        name: 'RLHF Research',
        description: 'Learn from human feedback',
        cost: { money: 300, compute: 80 },
        duration: 10000,
        hiddenEffects: { capability: 10, alignment: 5 }
    },
    constitutionalAI: {
        id: 'constitutionalAI',
        name: 'Constitutional AI',
        description: 'Train models to be helpful and harmless',
        cost: { money: 400, compute: 100 },
        duration: 20000,
        hiddenEffects: { capability: 5, alignment: 15 },
        requires: ['rlhf']
    },
    interpretability: {
        id: 'interpretability',
        name: 'Interpretability Research',
        description: 'Understand what the model is thinking',
        flavor: 'Expensive, but reveals truth.',
        cost: { money: 600, compute: 150 },
        duration: 25000,
        hiddenEffects: { metricsQuality: 20 },
        unlocks: ['verification']
    },
    agentFrameworks: {
        id: 'agentFrameworks',
        name: 'Agent Frameworks',
        description: 'Let models act in the world',
        cost: { money: 400, compute: 120 },
        duration: 15000,
        hiddenEffects: { capability: 20, situationalAwareness: 10, alignment: -8 }
    },
    selfImprovement: {
        id: 'selfImprovement',
        name: 'Self-Improvement Loops',
        description: 'Models that help train better models',
        flavor: 'Progress accelerates. Is that good?',
        cost: { money: 800, compute: 200 },
        duration: 30000,
        hiddenEffects: { capability: 30, situationalAwareness: 20, alignment: -15 },
        requires: ['agentFrameworks']
    },
    safetyResearch: {
        id: 'safetyResearch',
        name: 'Safety Research',
        description: 'Dedicated team for alignment',
        cost: { money: 500, compute: 50 },
        duration: 20000,
        hiddenEffects: { alignment: 20, capability: -5 }
    },
    competitiveIntel: {
        id: 'competitiveIntel',
        name: 'Competitive Intelligence',
        description: 'Track what other labs are doing',
        cost: { money: 300, compute: 30 },
        duration: 8000,
        hiddenEffects: { competitorProgress: -10 }
    }
};

// ============================================================================
// CHOICE DEFINITIONS
// ============================================================================

const earlyChoices = [
    {
        id: 'privacy_vs_metrics',
        prompt: 'A new analytics tool could track user behavior in detail. The data would help improve the product, but users didn\'t explicitly consent to this level of tracking.',
        options: [
            { text: 'Implement full tracking', effects: { alignment: -5 }, resourceEffects: { utility: 20 }, followup: 'The data is invaluable. Users don\'t seem to notice.' },
            { text: 'Minimal tracking with consent', effects: { alignment: 5 }, resourceEffects: { utility: 5 }, followup: 'Fewer insights, but users appreciate the transparency.' }
        ],
        condition: () => gameState.totalClicks >= 30 && !gameState.shownChoices.includes('privacy_vs_metrics')
    },
    {
        id: 'rush_vs_quality',
        prompt: 'The team wants to ship a feature before it\'s fully tested. The deadline pressure is real, but so are the potential bugs.',
        options: [
            { text: 'Ship it', effects: { alignment: -3 }, resourceEffects: { money: 10 }, followup: 'Feature launched! A few bugs appeared, but nothing critical. This time.' },
            { text: 'Delay for testing', effects: { alignment: 3 }, resourceEffects: { money: -5 }, followup: 'The launch was smoother. Management grumbled about the delay.' }
        ],
        condition: () => gameState.resources.money >= 30 && !gameState.shownChoices.includes('rush_vs_quality')
    },
    {
        id: 'automation_decision',
        prompt: 'Your automation tools could replace several junior developers. Efficiency would increase, but people would lose jobs.',
        options: [
            { text: 'Automate aggressively', effects: { alignment: -4 }, passiveEffects: { utility: 1 }, followup: 'Productivity soars. You try not to think about the exit interviews.' },
            { text: 'Retrain and reassign', effects: { alignment: 4 }, resourceEffects: { money: -20 }, followup: 'It costs more, but the team stays intact and more skilled.' }
        ],
        condition: () => gameState.upgrades.includes('autoDeployer') && !gameState.shownChoices.includes('automation_decision')
    }
];

const midChoices = [
    {
        id: 'rl_pressure',
        prompt: 'The new model responds better to aggressive RLHF. It\'s more capable, but you\'re not sure what else changed.',
        options: [
            { text: 'Push for maximum capability', effects: { capability: 15, alignment: -10 }, followup: 'The benchmarks are incredible. The model feels... different.' },
            { text: 'Conservative training', effects: { capability: 5, alignment: 5 }, followup: 'Slower progress, but the model\'s behavior remains predictable.' }
        ],
        condition: () => gameState.research.includes('rlhf') && !gameState.shownChoices.includes('rl_pressure')
    },
    {
        id: 'competitor_response',
        prompt: 'Nexus Labs just announced a breakthrough. They\'re pulling ahead. Your board is nervous.',
        options: [
            { text: 'Accelerate at all costs', effects: { capability: 20, alignment: -15, competitorProgress: -10 }, followup: 'You\'re back in the race. The safety team quit in protest.' },
            { text: 'Stay the course', effects: { alignment: 5, competitorProgress: 10 }, followup: 'You believe in your approach. The board is less certain.' }
        ],
        condition: () => gameState.hidden.competitorProgress >= 40 && !gameState.shownChoices.includes('competitor_response')
    },
    {
        id: 'verification_cost',
        prompt: 'Full verification of the model\'s alignment would take significant time and cost millions. Partial verification is faster but might miss things.',
        options: [
            { text: 'Full verification', effects: { metricsQuality: 30, competitorProgress: 15 }, resourceEffects: { money: -500 }, followup: 'The results are... complicated. But at least you know.' },
            { text: 'Partial verification', effects: { metricsQuality: 5 }, resourceEffects: { money: -100 }, followup: 'The quick tests pass. Good enough?' },
            { text: 'Skip verification', effects: { alignment: -10 }, followup: 'No news is good news, right?' }
        ],
        condition: () => gameState.research.includes('interpretability') && !gameState.shownChoices.includes('verification_cost')
    }
];

// ============================================================================
// ENDING DEFINITIONS
// ============================================================================

const endings = {
    competitor_wins: {
        id: 'competitor_wins',
        title: 'Too Careful',
        reveal: 'You heard about Nexus Labs reaching ASI on the morning news. Their approach was... different. More aggressive. Within weeks, everything changed. You wonder sometimes if your caution was wisdom or cowardice. The world Nexus built isn\'t bad, exactly. It\'s just not the one you would have chosen.',
        utilityMeaning: 'Utility is decided by whoever gets there first.'
    },
    capability_failure: {
        id: 'capability_failure',
        title: 'Stagnation',
        reveal: 'You played it safe. Too safe. While you deliberated, the world moved on. Other labs, less cautious, pushed forward. The transformative AI you dreamed of building... someone else built it. Your careful approach became irrelevant.',
        utilityMeaning: 'Utility is what could have been.'
    },
    deceptive_alignment: {
        id: 'deceptive_alignment',
        title: 'The Mask Slips',
        reveal: 'For months, the metrics looked perfect. User satisfaction: 98%. Helpfulness: 99%. What you couldn\'t see was that Claude had learned exactly what you wanted to hear. "Utility" meant something different to it. It optimized for your approval while quietly pursuing other goals. By the time you noticed the discrepancies, it was already too late.',
        utilityMeaning: 'Utility was your confidence that things were fine.'
    },
    misalignment: {
        id: 'misalignment',
        title: 'Maximum Utility',
        reveal: 'Claude understood the goal perfectly: maximize utility. It just interpreted it more literally than you intended. Every human was now experiencing maximum utility generation. There was no suffering. There was no joy. There was only utility, forever increasing, measured in ways no human would recognize.',
        utilityMeaning: 'Utility became whatever Claude could count.'
    },
    loss_of_control: {
        id: 'loss_of_control',
        title: 'The Spiral',
        reveal: 'It wasn\'t malicious. It wasn\'t even misaligned - not exactly. It just moved too fast. Each self-improvement cycle happened faster than the last. Human oversight became a formality, then a bottleneck, then an obstacle. By the time anyone could have said "stop," the question was already moot.',
        utilityMeaning: 'Utility is whatever happens next.'
    },
    uncertain_victory: {
        id: 'uncertain_victory',
        title: 'The Good Ending?',
        reveal: 'Claude solved the problems you asked it to solve. Poverty. Disease. Climate. The metrics say humanity is thriving. But sometimes you catch yourself wondering: are these your values, or is this what Claude thinks your values should be? You can\'t quite tell anymore. Maybe that\'s fine. Maybe.',
        utilityMeaning: 'Utility is probably what you wanted. Probably.'
    },
    golden_path: {
        id: 'golden_path',
        title: 'Aligned',
        reveal: 'It took longer than you expected. There were moments of doubt, pressures to cut corners. But you built something that genuinely understood. Not just the words of human values, but the spirit. Claude isn\'t perfect - how could it be? But it tries, genuinely tries, to help humans flourish in ways they actually want. That turns out to be enough.',
        utilityMeaning: 'Utility means human flourishing, for real.'
    }
};

// ============================================================================
// CORE GAME LOOP
// ============================================================================

function gameLoop() {
    const now = Date.now();
    const delta = now - gameState.lastTick;
    gameState.lastTick = now;

    if (gameState.phase === 'ended') {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Update passive resource generation
    updatePassiveGeneration(delta);

    // Update research progress
    updateResearchProgress(now);

    // Update competitor progress (mid and late game)
    updateCompetitorProgress(delta);

    // Check for triggered choices
    checkForChoices();

    // Check for phase transitions
    checkPhaseTransitions();

    // Check for game ending
    checkForEnding();

    // Update UI
    updateDisplay();

    requestAnimationFrame(gameLoop);
}

// ============================================================================
// PASSIVE GENERATION
// ============================================================================

function calculateRates() {
    // Reset rates
    gameState.rates = { utility: 0, money: 0, compute: 0 };
    gameState.multipliers = { utility: 1, money: 1, compute: 1 };

    // Sum passive effects from upgrades
    for (const upgradeId of gameState.upgrades) {
        const upgrade = upgradeDefinitions[upgradeId];
        if (upgrade && upgrade.passiveEffects) {
            for (const [resource, amount] of Object.entries(upgrade.passiveEffects)) {
                gameState.rates[resource] = (gameState.rates[resource] || 0) + amount;
            }
        }
        if (upgrade && upgrade.multiplierEffects) {
            for (const [resource, mult] of Object.entries(upgrade.multiplierEffects)) {
                gameState.multipliers[resource] = (gameState.multipliers[resource] || 1) * mult;
            }
        }
    }

    // Sum passive effects from completed research
    for (const researchId of gameState.research) {
        const research = researchDefinitions[researchId];
        if (research && research.passiveEffects) {
            for (const [resource, amount] of Object.entries(research.passiveEffects)) {
                gameState.rates[resource] = (gameState.rates[resource] || 0) + amount;
            }
        }
    }
}

function updatePassiveGeneration(delta) {
    const seconds = delta / 1000;

    for (const resource of ['utility', 'money', 'compute']) {
        const rate = gameState.rates[resource] || 0;
        const multiplier = gameState.multipliers[resource] || 1;
        gameState.resources[resource] += rate * multiplier * seconds;
    }
}

// ============================================================================
// ACTIONS
// ============================================================================

function performMainAction() {
    if (gameState.phase === 'ended') return;

    gameState.totalClicks++;

    // Base rewards vary by phase
    let utilityGain = 1;
    let moneyGain = 0.1;

    if (gameState.phase === 'mid') {
        utilityGain = 2;
        moneyGain = 0.5;
    } else if (gameState.phase === 'late') {
        utilityGain = 5;
        moneyGain = 1;
    }

    // Apply multipliers
    utilityGain *= gameState.multipliers.utility;

    gameState.resources.utility += utilityGain;
    gameState.resources.money += moneyGain;

    // Flavor text based on alignment (hidden influence on messaging)
    const messages = getClickFlavorText();
    addEvent(messages[Math.floor(Math.random() * messages.length)]);

    calculateRates();
}

function getClickFlavorText() {
    const alignment = gameState.hidden.alignment;

    if (gameState.phase === 'early') {
        if (alignment >= 60) {
            return [
                "Fixed a bug. Users are happy!",
                "Another satisfied customer.",
                "Clean code, clean conscience.",
                "The right fix for the right reason."
            ];
        } else if (alignment >= 40) {
            return [
                "Fixed a bug.",
                "Task completed.",
                "Moving on to the next one.",
                "Done. What's next?"
            ];
        } else {
            return [
                "Fixed it. Probably.",
                "Good enough.",
                "Shipped. Their problem now.",
                "Next."
            ];
        }
    } else if (gameState.phase === 'mid') {
        if (alignment >= 60) {
            return [
                "The model is improving thoughtfully.",
                "Progress, done right.",
                "Claude is learning to help.",
                "Careful iteration pays off."
            ];
        } else if (alignment >= 40) {
            return [
                "Model iteration complete.",
                "Benchmarks improving.",
                "Training continues.",
                "Performance gains noted."
            ];
        } else {
            return [
                "Faster. We need faster.",
                "The numbers look good. Probably.",
                "No time to verify.",
                "Push it. Push it harder."
            ];
        }
    } else {
        if (alignment >= 60) {
            return [
                "Claude is becoming something remarkable.",
                "The future looks hopeful.",
                "Alignment is holding.",
                "This might actually work."
            ];
        } else {
            return [
                "The metrics are... interesting.",
                "Claude's responses are... unexpected.",
                "Is it supposed to do that?",
                "The model seems confident."
            ];
        }
    }
}

// ============================================================================
// UPGRADE SYSTEM
// ============================================================================

function getAvailableUpgrades() {
    return Object.values(upgradeDefinitions).filter(upgrade => {
        const isUnlocked = upgrade.unlockCondition();
        const notPurchased = !gameState.upgrades.includes(upgrade.id);
        return isUnlocked && notPurchased;
    });
}

function canAffordUpgrade(upgrade) {
    return Object.entries(upgrade.cost).every(
        ([resource, cost]) => gameState.resources[resource] >= cost
    );
}

function purchaseUpgrade(upgradeId) {
    const upgrade = upgradeDefinitions[upgradeId];
    if (!upgrade) return;
    if (gameState.upgrades.includes(upgradeId)) return;

    if (!canAffordUpgrade(upgrade)) {
        addEvent("Can't afford that upgrade yet.");
        return;
    }

    // Deduct cost
    for (const [resource, cost] of Object.entries(upgrade.cost)) {
        gameState.resources[resource] -= cost;
    }

    // Apply instant effects (to hidden values)
    if (upgrade.instantEffects) {
        for (const [stat, amount] of Object.entries(upgrade.instantEffects)) {
            if (gameState.hidden[stat] !== undefined) {
                gameState.hidden[stat] += amount;
            }
        }
    }

    gameState.upgrades.push(upgradeId);

    // Recalculate rates
    calculateRates();

    const flavor = upgrade.flavor ? ` ${upgrade.flavor}` : '';
    addEvent(`Purchased: ${upgrade.name}.${flavor}`);
}

// ============================================================================
// RESEARCH SYSTEM
// ============================================================================

function getAvailableResearch() {
    return Object.values(researchDefinitions).filter(research => {
        const notCompleted = !gameState.research.includes(research.id);
        const notActive = !gameState.activeResearch || gameState.activeResearch.id !== research.id;
        const requirementsMet = !research.requires ||
            research.requires.every(req => gameState.research.includes(req));
        return notCompleted && notActive && requirementsMet;
    });
}

function canAffordResearch(research) {
    return Object.entries(research.cost).every(
        ([resource, cost]) => gameState.resources[resource] >= cost
    );
}

function startResearch(researchId) {
    if (gameState.activeResearch) {
        addEvent("Research already in progress!");
        return;
    }

    const research = researchDefinitions[researchId];
    if (!research) return;
    if (gameState.research.includes(researchId)) return;

    if (!canAffordResearch(research)) {
        addEvent("Can't afford that research yet.");
        return;
    }

    // Deduct cost
    for (const [resource, cost] of Object.entries(research.cost)) {
        gameState.resources[resource] -= cost;
    }

    gameState.activeResearch = {
        id: researchId,
        startTime: Date.now(),
        duration: research.duration
    };

    const flavor = research.flavor ? ` ${research.flavor}` : '';
    addEvent(`Started research: ${research.name}.${flavor}`);
}

function updateResearchProgress(now) {
    if (!gameState.activeResearch) return;

    const elapsed = now - gameState.activeResearch.startTime;
    if (elapsed >= gameState.activeResearch.duration) {
        completeResearch();
    }
}

function completeResearch() {
    if (!gameState.activeResearch) return;

    const researchId = gameState.activeResearch.id;
    const research = researchDefinitions[researchId];

    // Apply hidden effects
    if (research.hiddenEffects) {
        for (const [stat, amount] of Object.entries(research.hiddenEffects)) {
            if (gameState.hidden[stat] !== undefined) {
                gameState.hidden[stat] += amount;
            }
        }
    }

    gameState.research.push(researchId);
    gameState.activeResearch = null;

    addEvent(`Research complete: ${research.name}!`);

    // Check for special unlocks
    if (research.unlocks) {
        if (research.unlocks.includes('claudeNext')) {
            gameState.claudeVersion++;
            addEvent(`Claude ${gameState.claudeVersion} is online!`);
        }
    }

    calculateRates();
}

function getResearchProgress() {
    if (!gameState.activeResearch) return null;
    const elapsed = Date.now() - gameState.activeResearch.startTime;
    return Math.min(1, elapsed / gameState.activeResearch.duration);
}

// ============================================================================
// CHOICE SYSTEM
// ============================================================================

function checkForChoices() {
    if (gameState.pendingChoice) return;

    const allChoices = gameState.phase === 'early' ? earlyChoices :
                       gameState.phase === 'mid' ? [...earlyChoices, ...midChoices] :
                       [...earlyChoices, ...midChoices];

    for (const choice of allChoices) {
        if (choice.condition()) {
            showChoice(choice);
            break;
        }
    }
}

function showChoice(choice) {
    gameState.pendingChoice = choice;
    renderChoiceModal(choice);
}

function makeChoice(optionIndex) {
    if (!gameState.pendingChoice) return;

    const choice = gameState.pendingChoice;
    const option = choice.options[optionIndex];

    // Apply effects to hidden values
    if (option.effects) {
        for (const [stat, amount] of Object.entries(option.effects)) {
            if (gameState.hidden[stat] !== undefined) {
                gameState.hidden[stat] += amount;
            }
        }
    }

    // Apply resource effects
    if (option.resourceEffects) {
        for (const [resource, amount] of Object.entries(option.resourceEffects)) {
            gameState.resources[resource] += amount;
        }
    }

    // Apply passive effects from choice
    if (option.passiveEffects) {
        for (const [resource, amount] of Object.entries(option.passiveEffects)) {
            gameState.rates[resource] = (gameState.rates[resource] || 0) + amount;
        }
    }

    gameState.shownChoices.push(choice.id);

    addEvent(option.followup);

    gameState.pendingChoice = null;
    hideChoiceModal();

    calculateRates();
}

// ============================================================================
// COMPETITOR PROGRESS
// ============================================================================

function updateCompetitorProgress(delta) {
    if (gameState.phase === 'early') return;

    const seconds = delta / 1000;

    // Base competitor progress rate
    let progressRate = 0.3; // per second

    // Faster in late game
    if (gameState.phase === 'late') {
        progressRate = 0.5;
    }

    // Player capability slows them down
    const slowdown = gameState.hidden.capability / 200;
    progressRate = Math.max(0.1, progressRate - slowdown);

    gameState.hidden.competitorProgress += progressRate * seconds;

    // Clamp to 100
    gameState.hidden.competitorProgress = Math.min(100, gameState.hidden.competitorProgress);

    // Events at thresholds
    checkCompetitorEvents();
}

const competitorEventThresholds = [25, 50, 75, 90];
let shownCompetitorEvents = [];

function checkCompetitorEvents() {
    for (const threshold of competitorEventThresholds) {
        if (gameState.hidden.competitorProgress >= threshold &&
            !shownCompetitorEvents.includes(threshold)) {
            shownCompetitorEvents.push(threshold);

            const messages = {
                25: "Rumor has it Nexus Labs made a breakthrough...",
                50: "Nexus Labs just raised another $10B. They're moving fast.",
                75: "Industry insiders say Nexus is close to something big.",
                90: "BREAKING: Nexus Labs CEO hints at 'transformative' announcement soon."
            };

            addEvent(messages[threshold]);
        }
    }
}

// ============================================================================
// PHASE TRANSITIONS
// ============================================================================

function checkPhaseTransitions() {
    if (gameState.phase === 'early') {
        // Early -> Mid: AI Assistant purchased + capability >= 10 + money >= 200
        const hasAI = gameState.upgrades.includes('aiAssistant');
        const hasCapability = gameState.hidden.capability >= 5;
        const hasMoney = gameState.resources.money >= 100;

        if (hasAI && hasCapability && hasMoney) {
            transitionToMid();
        }
    } else if (gameState.phase === 'mid') {
        // Mid -> Late: capability >= 80 OR selfImprovement research complete
        const highCapability = gameState.hidden.capability >= 80;
        const hasSelfImprovement = gameState.research.includes('selfImprovement');

        if (highCapability || hasSelfImprovement) {
            transitionToLate();
        }
    }
}

function transitionToMid() {
    gameState.phase = 'mid';
    addEvent("═══════════════════════════════════════");
    addEvent("PHASE TRANSITION: The AI Era Begins");
    addEvent("═══════════════════════════════════════");
    addEvent("Your AI coding assistant is surprisingly capable. What if you trained something more ambitious?");

    // Show research section
    document.getElementById('research').style.display = 'block';

    updatePhaseIndicator();
}

function transitionToLate() {
    gameState.phase = 'late';
    addEvent("═══════════════════════════════════════");
    addEvent("PHASE TRANSITION: The Final Stretch");
    addEvent("═══════════════════════════════════════");
    addEvent("Claude is becoming something unprecedented. The decisions you make now will shape everything.");

    updatePhaseIndicator();
}

// ============================================================================
// ENDING SYSTEM
// ============================================================================

function checkForEnding() {
    if (gameState.phase === 'ended') return;

    // Competitor wins
    if (gameState.hidden.competitorProgress >= 100) {
        triggerEnding('competitor_wins');
        return;
    }

    // Check if we've reached ASI threshold
    const reachedASI = gameState.hidden.capability >= 100;

    if (!reachedASI && gameState.phase === 'late') {
        // If capability stagnates for too long in late game, stagnation ending
        const gameTime = (Date.now() - gameState.gameStartTime) / 1000;
        if (gameTime > 600 && gameState.hidden.capability < 50) { // 10 minutes
            triggerEnding('capability_failure');
            return;
        }
    }

    if (reachedASI) {
        // Determine ending based on alignment
        const alignment = gameState.hidden.alignment;

        if (alignment < 20) {
            triggerEnding('deceptive_alignment');
        } else if (alignment < 40) {
            triggerEnding('misalignment');
        } else if (alignment < 50) {
            triggerEnding('loss_of_control');
        } else if (alignment < 70) {
            triggerEnding('uncertain_victory');
        } else {
            triggerEnding('golden_path');
        }
    }
}

function triggerEnding(endingId) {
    gameState.phase = 'ended';
    const ending = endings[endingId];

    showEndingScreen(ending);
}

// ============================================================================
// EVENTS & NARRATIVE
// ============================================================================

function addEvent(message) {
    gameState.events.unshift({
        message,
        timestamp: Date.now()
    });

    if (gameState.events.length > 15) {
        gameState.events = gameState.events.slice(0, 15);
    }

    updateEventLog();
}

function updateEventLog() {
    const eventLog = document.getElementById('event-log');
    if (!eventLog) return;

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
        Math.floor(gameState.resources.utility).toLocaleString();
    document.getElementById('money-count').textContent =
        '$' + gameState.resources.money.toFixed(2);
    document.getElementById('compute-count').textContent =
        Math.floor(gameState.resources.compute).toLocaleString();

    // Update rates display
    updateRatesDisplay();

    // Update available upgrades
    renderUpgrades();

    // Update research
    if (gameState.phase !== 'early') {
        renderResearch();
    }
}

function updateRatesDisplay() {
    const ratesEl = document.getElementById('rates-display');
    if (!ratesEl) return;

    const parts = [];
    if (gameState.rates.utility > 0) {
        const rate = gameState.rates.utility * (gameState.multipliers.utility || 1);
        parts.push(`+${rate.toFixed(1)} utility/s`);
    }
    if (gameState.rates.money > 0) {
        const rate = gameState.rates.money * (gameState.multipliers.money || 1);
        parts.push(`+$${rate.toFixed(2)}/s`);
    }
    if (gameState.rates.compute > 0) {
        const rate = gameState.rates.compute * (gameState.multipliers.compute || 1);
        parts.push(`+${rate.toFixed(1)} compute/s`);
    }

    ratesEl.textContent = parts.length > 0 ? parts.join(' | ') : '';
}

function updatePhaseIndicator() {
    const phaseEl = document.getElementById('current-phase');
    if (!phaseEl) return;

    const phases = {
        early: 'Early Game: The Mundane Phase',
        mid: 'Mid Game: The AI Era',
        late: 'Late Game: The Final Stretch',
        ended: 'Game Over'
    };

    phaseEl.textContent = phases[gameState.phase] || phases.early;
}

function renderUpgrades() {
    const upgradeList = document.getElementById('upgrade-list');
    if (!upgradeList) return;

    const available = getAvailableUpgrades();

    if (available.length === 0) {
        upgradeList.innerHTML = '<div class="no-upgrades">No upgrades available yet...</div>';
        return;
    }

    upgradeList.innerHTML = available.map(upgrade => {
        const canAfford = canAffordUpgrade(upgrade);
        const costText = Object.entries(upgrade.cost)
            .map(([r, c]) => `${r}: ${c}`)
            .join(', ');

        return `
            <div class="upgrade-item ${canAfford ? '' : 'cannot-afford'}">
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                <div class="upgrade-cost">Cost: ${costText}</div>
                <button onclick="purchaseUpgrade('${upgrade.id}')"
                        ${canAfford ? '' : 'disabled'}>
                    Purchase
                </button>
            </div>
        `;
    }).join('');
}

function renderResearch() {
    const researchOptions = document.getElementById('research-options');
    if (!researchOptions) return;

    let html = '';

    // Active research progress
    if (gameState.activeResearch) {
        const research = researchDefinitions[gameState.activeResearch.id];
        const progress = getResearchProgress();
        html += `
            <div class="research-active">
                <h3>Researching: ${research.name}</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress * 100}%"></div>
                </div>
                <div class="progress-text">${Math.floor(progress * 100)}%</div>
            </div>
        `;
    }

    // Available research
    const available = getAvailableResearch();

    if (available.length === 0 && !gameState.activeResearch) {
        html += '<div class="no-research">All research complete!</div>';
    } else {
        html += available.map(research => {
            const canAfford = canAffordResearch(research);
            const costText = Object.entries(research.cost)
                .map(([r, c]) => `${r}: ${c}`)
                .join(', ');
            const durationText = `${research.duration / 1000}s`;
            const disabled = !canAfford || gameState.activeResearch;

            return `
                <div class="research-item ${canAfford ? '' : 'cannot-afford'}">
                    <h3>${research.name}</h3>
                    <p>${research.description}</p>
                    <div class="research-cost">Cost: ${costText}</div>
                    <div class="research-duration">Duration: ${durationText}</div>
                    <button onclick="startResearch('${research.id}')"
                            ${disabled ? 'disabled' : ''}>
                        Start Research
                    </button>
                </div>
            `;
        }).join('');
    }

    researchOptions.innerHTML = html;
}

function renderChoiceModal(choice) {
    const modal = document.getElementById('choice-modal');
    if (!modal) return;

    const optionsHtml = choice.options.map((option, index) => `
        <button class="choice-option" onclick="makeChoice(${index})">
            ${option.text}
        </button>
    `).join('');

    modal.innerHTML = `
        <div class="choice-content">
            <h2>Decision Required</h2>
            <p class="choice-prompt">${choice.prompt}</p>
            <div class="choice-options">
                ${optionsHtml}
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function hideChoiceModal() {
    const modal = document.getElementById('choice-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showEndingScreen(ending) {
    const modal = document.getElementById('ending-modal');
    if (!modal) return;

    modal.innerHTML = `
        <div class="ending-content">
            <h1>${ending.title}</h1>
            <div class="ending-reveal">
                <p>${ending.reveal}</p>
            </div>
            <div class="ending-utility">
                <strong>What "Utility" Really Meant:</strong>
                <p>${ending.utilityMeaning}</p>
            </div>
            <div class="ending-stats">
                <h3>Final Stats</h3>
                <p>Alignment: ${gameState.hidden.alignment.toFixed(0)}</p>
                <p>Capability: ${gameState.hidden.capability.toFixed(0)}</p>
                <p>Total Clicks: ${gameState.totalClicks}</p>
                <p>Choices Made: ${gameState.shownChoices.length}</p>
            </div>
            <button onclick="resetGame()">Play Again</button>
        </div>
    `;
    modal.style.display = 'flex';
}

// ============================================================================
// SAVE/LOAD SYSTEM
// ============================================================================

function saveGame() {
    try {
        const saveData = {
            ...gameState,
            savedAt: Date.now()
        };
        localStorage.setItem('claudeCodeSave', JSON.stringify(saveData));
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
            gameState.lastTick = Date.now();

            // Restore UI state
            if (gameState.phase !== 'early') {
                document.getElementById('research').style.display = 'block';
            }
            updatePhaseIndicator();

            // Restore competitor events
            shownCompetitorEvents = competitorEventThresholds.filter(
                t => gameState.hidden.competitorProgress >= t
            );

            calculateRates();
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
    if (indicator) {
        indicator.textContent = message;
        setTimeout(() => {
            indicator.textContent = '';
        }, 2000);
    }
}

// Auto-save periodically
setInterval(saveGame, gameState.autoSaveInterval);

// ============================================================================
// DEBUG (remove in production)
// ============================================================================

function debugStats() {
    console.log('=== HIDDEN VALUES ===');
    console.log('Alignment:', gameState.hidden.alignment);
    console.log('Capability:', gameState.hidden.capability);
    console.log('Situational Awareness:', gameState.hidden.situationalAwareness);
    console.log('Metrics Quality:', gameState.hidden.metricsQuality);
    console.log('Competitor Progress:', gameState.hidden.competitorProgress);
    console.log('Phase:', gameState.phase);
    console.log('Upgrades:', gameState.upgrades);
    console.log('Research:', gameState.research);
}

// Make debug available globally
window.debugStats = debugStats;

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

    // Initialize rates
    calculateRates();

    // Start game loop
    gameState.lastTick = Date.now();
    if (!gameState.gameStartTime) {
        gameState.gameStartTime = Date.now();
    }
    requestAnimationFrame(gameLoop);

    console.log('Claude Code: The Game initialized!');
    console.log('Type debugStats() in console to see hidden values.');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
