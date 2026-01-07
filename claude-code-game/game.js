/**
 * Claude Code: The Game
 *
 * An incremental game about an indie developer navigating the rise of AI.
 * Choices branch the narrative - there are no "phases", only consequences.
 */

// ============================================================================
// GAME STATE
// ============================================================================

const gameState = {
    // Core resources (always visible)
    resources: {
        money: 500,        // Dollars - need to pay rent!
        time: 100,         // Hours available this "week"
        energy: 100,       // Motivation/focus (regenerates)
        codebase: 0        // Quality/size of your work
    },

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
        week: 1,                   // Time progression
        monthlyRent: 1500          // The grind is real
    },

    // Completed/active upgrades
    upgrades: [],
    declinedUpgrades: [],  // Declining has consequences too

    // Passive effects
    passiveEffects: [],

    // Timing
    lastTick: Date.now(),
    tickRate: 1000  // 1 second per tick
};

// ============================================================================
// ACTIONS - What the player can do
// ============================================================================

const actions = {
    vibeCode: {
        id: 'vibeCode',
        name: 'Vibe Code',
        description: 'Start something new. No plan, just vibes. Could be brilliant, could be garbage.',
        cost: { time: 20, energy: 30 },
        execute: () => {
            const roll = Math.random();
            if (roll > 0.7) {
                // Great outcome
                gameState.resources.codebase += 15;
                addEvent("You got into flow state. Something clicked. This might actually be good.", 'success');
            } else if (roll > 0.3) {
                // Okay outcome
                gameState.resources.codebase += 5;
                addEvent("You made progress. Not your best work, but it's something.", 'neutral');
            } else {
                // Bad outcome
                gameState.resources.codebase += 1;
                addEvent("You stared at the screen for hours. Wrote code. Deleted code. Wrote more code. Meh.", 'negative');
            }
            checkNarrativeTriggers();
        },
        available: () => true
    },

    iterate: {
        id: 'iterate',
        name: 'Iterate',
        description: 'Improve what you have. Fix bugs, refactor, polish. The unsexy work that matters.',
        cost: { time: 15, energy: 20 },
        execute: () => {
            if (gameState.resources.codebase < 10) {
                addEvent("You tried to iterate, but... iterate on what? You need to build something first.", 'negative');
                return;
            }
            const improvement = Math.min(10, gameState.resources.codebase * 0.2);
            gameState.resources.codebase += improvement;
            addEvent("You cleaned up tech debt and fixed some bugs. The codebase feels tighter.", 'success');

            // Iteration builds craft mastery if on bootstrap path
            if (gameState.pathResources.craftMastery !== null) {
                gameState.pathResources.craftMastery += 1;
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 10
    },

    freelance: {
        id: 'freelance',
        name: 'Freelance Gig',
        description: 'Take contract work. Reliable money, but it\'s time away from your own projects.',
        cost: { time: 30, energy: 40 },
        execute: () => {
            const pay = 200 + Math.floor(Math.random() * 100);
            gameState.resources.money += pay;
            addEvent(`Finished a freelance gig. $${pay} in the bank. Client happy enough.`, 'neutral');

            // Freelancing doesn't build your thing
            if (Math.random() > 0.7) {
                addEvent("While debugging their code, you had an idea for your own project...", 'neutral');
                gameState.resources.codebase += 2;
            }
            checkNarrativeTriggers();
        },
        available: () => true
    },

    rest: {
        id: 'rest',
        name: 'Rest',
        description: 'Take a break. You can\'t pour from an empty cup.',
        cost: { time: 10 },
        execute: () => {
            gameState.resources.energy = Math.min(100, gameState.resources.energy + 40);
            const messages = [
                "You went for a walk. Touched grass. It helped.",
                "You binged a show. Sometimes that's necessary.",
                "You cooked a real meal for once. Felt human.",
                "You called a friend. Remembered there's a world outside code."
            ];
            addEvent(messages[Math.floor(Math.random() * messages.length)], 'neutral');
        },
        available: () => true
    },

    ship: {
        id: 'ship',
        name: 'Ship It',
        description: 'Put your work out there. Scary but necessary.',
        cost: { time: 10, energy: 50 },
        execute: () => {
            if (gameState.resources.codebase < 30) {
                addEvent("You're not ready to ship. Deep down, you know it. Keep building.", 'negative');
                return;
            }

            // Shipping is a big deal
            gameState.narrative.flags.hasShipped = true;
            const quality = gameState.resources.codebase;

            if (quality >= 80) {
                addEvent("You shipped. People noticed. This might be the start of something.", 'success');
                gameState.narrative.flags.successfulLaunch = true;
            } else if (quality >= 50) {
                addEvent("You shipped. A few people tried it. The feedback was... mixed but useful.", 'neutral');
            } else {
                addEvent("You shipped. Crickets. Maybe three downloads. It stings, but at least it's out there.", 'negative');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 30 && !gameState.narrative.flags.hasShipped
    }
};

// ============================================================================
// UPGRADES - Branching decisions and improvements
// ============================================================================

const upgradeDefinitions = {
    // ===== EARLY GAME UPGRADES =====
    betterChair: {
        id: 'betterChair',
        name: 'Ergonomic Setup',
        description: 'Your back hurts. Your wrists hurt. You\'ve been telling yourself you\'ll upgrade "when you can afford it." But the pain is affecting your work, and you can afford it. Barely.',
        cost: { money: 300 },
        decisions: [
            {
                id: 'buy',
                label: 'Invest in yourself',
                effect: () => {
                    gameState.resources.energy += 10; // Permanent boost to max
                    gameState.passiveEffects.push({ id: 'ergonomic', energyRegen: 2 });
                    addEvent("The new chair arrived. Your back thanks you. You can actually focus now.", 'success');
                }
            },
            {
                id: 'skip',
                label: 'The pain builds character',
                effect: () => {
                    addEvent("You close the browser tab. The money stays in the account. The pain stays in your back.", 'neutral');
                }
            }
        ],
        condition: () => gameState.narrative.week >= 2 && !hasUpgrade('betterChair')
    },

    coffeeSubscription: {
        id: 'coffeeSubscription',
        name: 'Premium Coffee Subscription',
        description: 'Good coffee is a productivity multiplier. Or that\'s what you tell yourself. The fancy subscription is $40/month but the beans are genuinely better.',
        cost: { money: 40 },
        recurring: true,  // Monthly cost
        decisions: [
            {
                id: 'subscribe',
                label: 'Treat yourself',
                effect: () => {
                    gameState.passiveEffects.push({ id: 'coffee', energyRegen: 1, monthlyCost: 40 });
                    addEvent("First bag arrived. The apartment smells amazing. This was the right call.", 'success');
                }
            },
            {
                id: 'skip',
                label: 'Folgers is fine',
                effect: () => {
                    addEvent("Instant coffee it is. You've had worse.", 'neutral');
                }
            }
        ],
        condition: () => gameState.narrative.week >= 3 && !hasUpgrade('coffeeSubscription')
    },

    // ===== POST-SHIP UPGRADES =====
    userAnalytics: {
        id: 'userAnalytics',
        name: 'Analytics Dashboard',
        description: 'You could add analytics to see how people actually use your app. What they click, where they drop off, how long they stay. The data would be valuable. But it feels a little... voyeuristic? Users didn\'t sign up to be watched.',
        cost: { time: 20, energy: 30 },
        decisions: [
            {
                id: 'fullTracking',
                label: 'Add comprehensive tracking',
                effect: () => {
                    gameState.resources.codebase += 10;
                    gameState.narrative.flags.heavyTracking = true;
                    addEvent("Analytics installed. The data flows in. You can see exactly what users do. It's... a lot.", 'neutral');
                }
            },
            {
                id: 'minimalTracking',
                label: 'Privacy-first, minimal data',
                effect: () => {
                    gameState.resources.codebase += 5;
                    gameState.narrative.flags.privacyFocused = true;
                    addEvent("You added just the basics - page views, nothing personal. Users probably won't even notice, but you feel better about it.", 'success');
                }
            },
            {
                id: 'noTracking',
                label: 'No tracking at all',
                effect: () => {
                    gameState.narrative.flags.noTracking = true;
                    addEvent("No analytics. You'll figure out what users want by... asking them? Reading reviews? Flying blind feels principled but scary.", 'neutral');
                }
            }
        ],
        condition: () => gameState.narrative.flags.hasShipped && !hasUpgrade('userAnalytics')
    },

    // ===== FIRST SUCCESS BRANCH =====
    firstRevenue: {
        id: 'firstRevenue',
        name: 'Monetization Decision',
        description: 'People are using your app. Not millions, but enough that you could charge for it. You could stay free and grow, go freemium, or charge upfront. Each path shapes what comes next.',
        cost: {},
        decisions: [
            {
                id: 'stayFree',
                label: 'Stay free for now',
                effect: () => {
                    gameState.narrative.branch = 'bootstrap';
                    gameState.pathResources.userTrust = 80;
                    gameState.pathResources.craftMastery = 10;
                    gameState.narrative.flags.bootstrap = true;
                    addEvent("You keep it free. Users love you for it. The goodwill feels valuable, even if it doesn't pay rent.", 'success');
                }
            },
            {
                id: 'freemium',
                label: 'Freemium model',
                effect: () => {
                    gameState.narrative.branch = 'growth_early';
                    gameState.pathResources.userTrust = 50;
                    gameState.pathResources.runway = 6;
                    gameState.narrative.flags.freemium = true;
                    addEvent("You add a premium tier. Some users upgrade. Some complain. Welcome to SaaS.", 'neutral');
                }
            },
            {
                id: 'paidUpfront',
                label: 'Charge upfront',
                effect: () => {
                    gameState.narrative.branch = 'bootstrap';
                    gameState.pathResources.userTrust = 60;
                    gameState.pathResources.craftMastery = 10;
                    gameState.resources.money += 200;
                    gameState.narrative.flags.paidApp = true;
                    addEvent("$5 upfront. The downloads slow down, but each one feels more real. These users chose to pay.", 'success');
                }
            }
        ],
        condition: () => gameState.narrative.flags.successfulLaunch && !hasUpgrade('firstRevenue')
    },

    // ===== AI DECISION (Early) =====
    aiCodingAssistant: {
        id: 'aiCodingAssistant',
        name: 'AI Coding Assistant',
        description: 'You\'ve heard about these AI coding tools. Everyone\'s talking about them. You tried one briefly - it was genuinely impressive. It could double your output. Maybe more.\n\nBut your code has always been yours. You know every line, every quirk, every intentional decision. Bringing in an AI means giving up some of that. The code it writes would be... someone else\'s? Something else\'s?',
        cost: { money: 20 }, // Monthly subscription
        recurring: true,
        decisions: [
            {
                id: 'fullIntegration',
                label: 'Go all in on AI assistance',
                effect: () => {
                    gameState.narrative.flags.aiAdopted = true;
                    gameState.narrative.flags.aiFullIntegration = true;
                    gameState.pathResources.aiCapability = 30;
                    gameState.pathResources.oversight = 70;
                    gameState.pathResources.dependency = 20;
                    gameState.passiveEffects.push({
                        id: 'aiAssist',
                        codebaseMultiplier: 1.5,
                        monthlyCost: 20
                    });
                    addEvent("You integrate the AI assistant fully. The suggestions come fast. Your output doubles. It's a little disorienting - is this still your code?", 'neutral');
                }
            },
            {
                id: 'carefulUse',
                label: 'Use it carefully, stay in control',
                effect: () => {
                    gameState.narrative.flags.aiAdopted = true;
                    gameState.narrative.flags.aiCarefulUse = true;
                    gameState.pathResources.aiCapability = 20;
                    gameState.pathResources.oversight = 90;
                    gameState.pathResources.dependency = 5;
                    gameState.passiveEffects.push({
                        id: 'aiAssist',
                        codebaseMultiplier: 1.2,
                        monthlyCost: 20
                    });
                    addEvent("You set rules for yourself: AI for boilerplate only. Every suggestion gets reviewed. Slower, but the code still feels like yours.", 'success');
                }
            },
            {
                id: 'reject',
                label: 'Not yet. Maybe not ever.',
                effect: () => {
                    gameState.narrative.flags.aiRejected = true;
                    if (gameState.pathResources.craftMastery !== null) {
                        gameState.pathResources.craftMastery += 5;
                    }
                    addEvent("You close the tab. The old way still works. Maybe you're a dinosaur, but at least you understand every line you write.", 'neutral');
                }
            }
        ],
        condition: () =>
            gameState.narrative.week >= 8 &&
            gameState.resources.codebase >= 50 &&
            !hasUpgrade('aiCodingAssistant')
    }
};

// ============================================================================
// EVENTS & NARRATIVE
// ============================================================================

function addEvent(message, type = 'neutral') {
    gameState.narrative.events.unshift({
        message,
        type,
        week: gameState.narrative.week,
        timestamp: Date.now()
    });

    // Keep last 20 events
    if (gameState.narrative.events.length > 20) {
        gameState.narrative.events = gameState.narrative.events.slice(0, 20);
    }

    renderEvents();
}

function checkNarrativeTriggers() {
    // Check for narrative branch triggers based on game state
    const { flags } = gameState.narrative;
    const { codebase, money } = gameState.resources;

    // First success trigger
    if (codebase >= 50 && flags.hasShipped && !flags.firstSuccessTrigger) {
        flags.firstSuccessTrigger = true;
        addEvent("You check your download stats. The numbers are... actually growing? People are using this thing you made.", 'success');
    }

    // Money trouble
    if (money < 100 && !flags.moneyWarning) {
        flags.moneyWarning = true;
        addEvent("Your bank balance is getting low. Rent is due soon. Maybe take some freelance work?", 'negative');
    }

    // Reset money warning when recovered
    if (money >= 500 && flags.moneyWarning) {
        flags.moneyWarning = false;
    }
}

// ============================================================================
// GAME LOOP
// ============================================================================

function gameLoop() {
    const now = Date.now();
    const delta = now - gameState.lastTick;

    if (delta >= gameState.tickRate) {
        gameState.lastTick = now;
        tick();
    }

    requestAnimationFrame(gameLoop);
}

function tick() {
    // Regenerate energy over time
    let energyRegen = 1;
    for (const effect of gameState.passiveEffects) {
        if (effect.energyRegen) {
            energyRegen += effect.energyRegen;
        }
    }
    gameState.resources.energy = Math.min(100, gameState.resources.energy + energyRegen * 0.1);

    // Apply codebase multipliers
    // (Passive codebase growth happens very slowly, if at all)

    updateDisplay();
}

function advanceWeek() {
    gameState.narrative.week++;
    gameState.resources.time = 100; // Reset weekly time

    // Deduct rent every 4 weeks
    if (gameState.narrative.week % 4 === 0) {
        gameState.resources.money -= gameState.narrative.monthlyRent;
        addEvent(`Rent day. -$${gameState.narrative.monthlyRent}. The grind continues.`, 'negative');

        // Deduct recurring costs
        for (const effect of gameState.passiveEffects) {
            if (effect.monthlyCost) {
                gameState.resources.money -= effect.monthlyCost;
            }
        }

        // Check for game over
        if (gameState.resources.money < 0) {
            triggerGameOver('broke');
        }
    }

    // Random events based on narrative state
    generateWeeklyEvent();

    updateDisplay();
}

function generateWeeklyEvent() {
    const { flags, branch, week } = gameState.narrative;
    const { money, codebase, energy } = gameState.resources;
    const roll = Math.random();

    // Early game flavor events
    if (week <= 4 && roll > 0.6) {
        const earlyEvents = [
            { msg: "Your neighbor's wifi password changed. Time to actually pay for internet.", type: 'neutral' },
            { msg: "You discovered a new coffee shop with good wifi. Productivity location unlocked.", type: 'success' },
            { msg: "Your laptop fan is making concerning noises. It's fine. Probably.", type: 'warning' },
            { msg: "You checked Twitter for 'just five minutes'. It was two hours.", type: 'negative', energyLoss: 10 },
            { msg: "A friend asked what you're working on. You explained it. They nodded politely.", type: 'neutral' }
        ];
        const event = earlyEvents[Math.floor(Math.random() * earlyEvents.length)];
        addEvent(event.msg, event.type);
        if (event.energyLoss) gameState.resources.energy -= event.energyLoss;
        return;
    }

    // Low money events
    if (money < 300 && roll > 0.5) {
        const brokeEvents = [
            "You checked your bank balance. You checked it again. Still the same number.",
            "Ramen for dinner again. At least you're efficient at cooking it now.",
            "Your credit card company sent a 'friendly reminder'. How thoughtful.",
            "You calculated how many days until rent. Then stopped calculating."
        ];
        addEvent(brokeEvents[Math.floor(Math.random() * brokeEvents.length)], 'warning');
        return;
    }

    // Post-ship events
    if (flags.hasShipped && roll > 0.6) {
        const shipEvents = [
            { msg: "Someone wrote about your app on Hacker News. Traffic spiked. Mostly tire-kickers, but still.", type: 'success', codebase: 2 },
            { msg: "A user reported a bug. A real bug report! Someone cares enough to report bugs!", type: 'success' },
            { msg: "You got your first 1-star review. It stung more than expected.", type: 'negative' },
            { msg: "Someone forked your repo on GitHub. Flattering or threatening? Both?", type: 'neutral' },
            { msg: "A user said your app 'changed their workflow'. You screenshot it for dark days.", type: 'success', codebase: 1 },
            { msg: "You found a tutorial someone made for your app. You didn't write it. Wild.", type: 'success' }
        ];
        const event = shipEvents[Math.floor(Math.random() * shipEvents.length)];
        addEvent(event.msg, event.type);
        if (event.codebase) gameState.resources.codebase += event.codebase;
        return;
    }

    // AI-related events
    if (flags.aiAdopted && roll > 0.65) {
        const aiEvents = [
            { msg: "The AI suggested something you didn't expect. It was actually... good?", type: 'neutral' },
            { msg: "You spent an hour debugging AI-generated code. The irony isn't lost on you.", type: 'negative' },
            { msg: "The AI completed a task faster than you could have. Efficient. Unsettling.", type: 'neutral' },
            { msg: "You caught the AI making a subtle mistake. Good thing you're still paying attention.", type: 'warning' }
        ];
        if (flags.aiFullIntegration) {
            aiEvents.push({ msg: "You're not sure which parts of the codebase you wrote anymore. Does it matter?", type: 'warning' });
            aiEvents.push({ msg: "The AI suggested refactoring code it wrote last week. It's optimizing itself?", type: 'neutral' });
        }
        const event = aiEvents[Math.floor(Math.random() * aiEvents.length)];
        addEvent(event.msg, event.type);
        return;
    }

    // Bootstrap path events
    if (branch === 'bootstrap' && roll > 0.65) {
        const bootstrapEvents = [
            { msg: "A user emailed you directly with a feature request. They said 'please' and everything.", type: 'success', trust: 2 },
            { msg: "Someone compared your app favorably to a VC-funded competitor. David vs Goliath vibes.", type: 'success' },
            { msg: "You turned down a feature request. It didn't fit. Users respected that.", type: 'success', trust: 1 },
            { msg: "A user offered to help translate your app. The community is growing.", type: 'success' }
        ];
        const event = bootstrapEvents[Math.floor(Math.random() * bootstrapEvents.length)];
        addEvent(event.msg, event.type);
        if (event.trust && gameState.pathResources.userTrust !== null) {
            gameState.pathResources.userTrust += event.trust;
        }
        return;
    }

    // Generic flavor events
    if (roll > 0.75) {
        const genericEvents = [
            "You refactored something. It's cleaner now. Nobody will ever notice.",
            "You read a blog post about productivity. Ironically, it cost you an hour.",
            "Your standing desk reminded you to stand. You ignored it.",
            "You pushed code on a Friday. Living dangerously."
        ];
        addEvent(genericEvents[Math.floor(Math.random() * genericEvents.length)], 'neutral');
    }
}

function triggerGameOver(reason) {
    gameState.narrative.flags.gameOver = true;
    gameState.narrative.flags.gameOverReason = reason;

    if (reason === 'broke') {
        addEvent("You couldn't make rent. The dream is over, for now. Maybe you'll try again someday.", 'negative');
    }

    showGameOver();
}

// ============================================================================
// UI HELPERS
// ============================================================================

function hasUpgrade(id) {
    return gameState.upgrades.includes(id) || gameState.declinedUpgrades.includes(id);
}

function canAffordAction(action) {
    if (!action.cost) return true;
    for (const [resource, cost] of Object.entries(action.cost)) {
        if (gameState.resources[resource] < cost) return false;
    }
    return true;
}

function canAffordUpgrade(upgrade) {
    if (!upgrade.cost) return true;
    for (const [resource, cost] of Object.entries(upgrade.cost)) {
        if (gameState.resources[resource] < cost) return false;
    }
    return true;
}

function executeAction(actionId) {
    const action = actions[actionId];
    if (!action || !action.available() || !canAffordAction(action)) return;

    // Deduct costs
    for (const [resource, cost] of Object.entries(action.cost || {})) {
        gameState.resources[resource] -= cost;
    }

    action.execute();

    // Check if time is depleted - advance to next week
    if (gameState.resources.time <= 0) {
        advanceWeek();
    }

    updateDisplay();
}

function executeUpgradeDecision(upgradeId, decisionId) {
    const upgrade = upgradeDefinitions[upgradeId];
    if (!upgrade) return;

    const decision = upgrade.decisions.find(d => d.id === decisionId);
    if (!decision) return;

    // Deduct costs (if accepting)
    if (decisionId !== 'skip' && decisionId !== 'reject') {
        for (const [resource, cost] of Object.entries(upgrade.cost || {})) {
            gameState.resources[resource] -= cost;
        }
    }

    decision.effect();
    gameState.upgrades.push(upgradeId);

    // Track declined upgrades
    if (decisionId === 'skip' || decisionId === 'reject' || decisionId === 'noTracking') {
        gameState.declinedUpgrades.push(upgradeId);
    }

    updateDisplay();
}

// ============================================================================
// RENDERING
// ============================================================================

function updateDisplay() {
    renderResources();
    renderActions();
    renderUpgrades();
    renderPathResources();
}

// Track previous values for change detection
let previousResources = { ...gameState.resources };

function renderResources() {
    const resources = ['money', 'time', 'energy', 'codebase'];

    resources.forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;

        const currentValue = key === 'codebase' ? gameState.resources[key].toFixed(0) : Math.floor(gameState.resources[key]);
        const previousValue = previousResources[key];

        el.textContent = currentValue;

        // Flash effect on change
        if (previousValue !== undefined && currentValue !== previousValue) {
            el.classList.remove('flash-up', 'flash-down');
            void el.offsetWidth; // Trigger reflow to restart animation
            el.classList.add(currentValue > previousValue ? 'flash-up' : 'flash-down');
        }
    });

    document.getElementById('week').textContent = gameState.narrative.week;

    // Add low resource warnings
    const moneyEl = document.querySelector('.resource[data-resource="money"]');
    const energyEl = document.querySelector('.resource[data-resource="energy"]');
    if (moneyEl) moneyEl.classList.toggle('low', gameState.resources.money < 200);
    if (energyEl) energyEl.classList.toggle('low', gameState.resources.energy < 30);

    // Update previous values
    previousResources = { ...gameState.resources };
}

function renderPathResources() {
    const container = document.getElementById('path-resources');
    if (!container) return;

    let html = '';

    for (const [key, value] of Object.entries(gameState.pathResources)) {
        if (value !== null) {
            const label = key.replace(/([A-Z])/g, ' $1').trim();
            html += `
                <div class="resource path-resource">
                    <span class="resource-label">${label}:</span>
                    <span class="resource-value">${value}</span>
                </div>
            `;
        }
    }

    container.innerHTML = html;
}

function renderActions() {
    const container = document.getElementById('actions-list');
    if (!container) return;

    let html = '';

    for (const action of Object.values(actions)) {
        if (!action.available()) continue;

        const canAfford = canAffordAction(action);
        const costItems = Object.entries(action.cost || {}).map(([r, c]) => {
            const hasEnough = gameState.resources[r] >= c;
            return `<span class="cost-item ${hasEnough ? '' : 'insufficient'}">${c} ${r}</span>`;
        }).join('');

        html += `
            <div class="action-card ${canAfford ? '' : 'disabled'}" onclick="${canAfford ? `executeAction('${action.id}')` : ''}">
                <div class="action-name">${action.name}</div>
                <div class="action-description">${action.description}</div>
                ${costItems ? `<div class="action-cost">${costItems}</div>` : ''}
            </div>
        `;
    }

    container.innerHTML = html || '<p class="no-upgrades">No actions available right now.</p>';
}

function renderUpgrades() {
    const container = document.getElementById('upgrades-list');
    if (!container) return;

    let html = '';

    for (const upgrade of Object.values(upgradeDefinitions)) {
        if (!upgrade.condition()) continue;

        const canAfford = canAffordUpgrade(upgrade);
        const costText = Object.entries(upgrade.cost || {})
            .map(([r, c]) => `$${c}${upgrade.recurring ? '/month' : ''}`)
            .join(', ');

        const isDecline = (id) => ['skip', 'reject', 'noTracking'].includes(id);

        const decisionsHtml = upgrade.decisions.map((d, i) => {
            const isPrimary = i === 0 && !isDecline(d.id);
            const isDeclineBtn = isDecline(d.id);
            const disabled = !canAfford && !isDeclineBtn;

            return `
                <button
                    class="decision-btn ${isPrimary ? 'primary' : ''} ${isDeclineBtn ? 'decline' : ''}"
                    onclick="executeUpgradeDecision('${upgrade.id}', '${d.id}')"
                    ${disabled ? 'disabled' : ''}
                >
                    ${d.label}
                </button>
            `;
        }).join('');

        html += `
            <div class="upgrade-card">
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-description">${upgrade.description.replace(/\n/g, '<br>')}</div>
                ${costText ? `<div class="upgrade-cost ${upgrade.recurring ? 'recurring' : ''}">${costText}</div>` : ''}
                <div class="upgrade-decisions">
                    ${decisionsHtml}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || '<p class="no-upgrades">No decisions to make right now. Keep working.</p>';
}

function renderEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;

    const typeToClass = {
        'success': 'good',
        'positive': 'good',
        'negative': 'bad',
        'warning': 'warning',
        'milestone': 'milestone',
        'neutral': ''
    };

    const html = gameState.narrative.events.map(event => `
        <div class="event-message ${typeToClass[event.type] || ''}">
            ${event.message}
        </div>
    `).join('');

    container.innerHTML = html || '<div class="event-message">Your story begins...</div>';
}

function showGameOver() {
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// ============================================================================
// DEV TOOLS
// ============================================================================

const devTools = {
    addMoney: (amount = 1000) => {
        gameState.resources.money += amount;
        addEvent(`[DEV] Added $${amount}`, 'neutral');
        updateDisplay();
    },

    addCodebase: (amount = 50) => {
        gameState.resources.codebase += amount;
        addEvent(`[DEV] Added ${amount} codebase`, 'neutral');
        updateDisplay();
    },

    setWeek: (week) => {
        gameState.narrative.week = week;
        addEvent(`[DEV] Set week to ${week}`, 'neutral');
        updateDisplay();
    },

    setFlag: (flag, value = true) => {
        gameState.narrative.flags[flag] = value;
        addEvent(`[DEV] Set flag ${flag} = ${value}`, 'neutral');
        updateDisplay();
    },

    setBranch: (branch) => {
        gameState.narrative.branch = branch;
        addEvent(`[DEV] Set branch to ${branch}`, 'neutral');
        updateDisplay();
    },

    showState: () => {
        console.log('=== GAME STATE ===');
        console.log('Resources:', gameState.resources);
        console.log('Path Resources:', gameState.pathResources);
        console.log('Narrative:', gameState.narrative);
        console.log('Upgrades:', gameState.upgrades);
        console.log('Passive Effects:', gameState.passiveEffects);
    },

    triggerUpgrade: (upgradeId) => {
        // Force an upgrade to appear regardless of conditions
        const upgrade = upgradeDefinitions[upgradeId];
        if (upgrade) {
            const originalCondition = upgrade.condition;
            upgrade.condition = () => true;
            updateDisplay();
            upgrade.condition = originalCondition;
        }
    },

    fastForward: (weeks = 4) => {
        for (let i = 0; i < weeks; i++) {
            advanceWeek();
        }
    },

    unlockAllPaths: () => {
        // For testing different narrative branches
        gameState.pathResources.userTrust = 50;
        gameState.pathResources.craftMastery = 10;
        gameState.pathResources.runway = 12;
        gameState.pathResources.teamMorale = 70;
        gameState.pathResources.marketPosition = 30;
        gameState.pathResources.aiCapability = 20;
        gameState.pathResources.oversight = 80;
        gameState.pathResources.dependency = 10;
        updateDisplay();
    }
};

// Make dev tools globally available
window.dev = devTools;

// ============================================================================
// SAVE/LOAD
// ============================================================================

function saveGame() {
    try {
        localStorage.setItem('claudeCodeGame', JSON.stringify(gameState));
        addEvent('Game saved.', 'neutral');
    } catch (e) {
        console.error('Failed to save:', e);
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem('claudeCodeGame');
        if (saved) {
            Object.assign(gameState, JSON.parse(saved));
            gameState.lastTick = Date.now();
            updateDisplay();
            return true;
        }
    } catch (e) {
        console.error('Failed to load:', e);
    }
    return false;
}

function resetGame() {
    if (confirm('Start over? Your progress will be lost.')) {
        localStorage.removeItem('claudeCodeGame');
        location.reload();
    }
}

// Auto-save every minute
setInterval(saveGame, 60000);

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Try to load saved game
    if (!loadGame()) {
        // New game - add welcome event
        addEvent("You're an indie developer. You've got a laptop, some savings, and a lot of ideas. Time to build something.", 'neutral');
    }

    // Start game loop
    gameState.lastTick = Date.now();
    requestAnimationFrame(gameLoop);

    // Wire up button handlers
    document.getElementById('save-btn')?.addEventListener('click', saveGame);
    document.getElementById('load-btn')?.addEventListener('click', () => {
        if (loadGame()) {
            addEvent('Game loaded.', 'neutral');
        }
    });
    document.getElementById('reset-btn')?.addEventListener('click', resetGame);
    document.getElementById('restart-btn')?.addEventListener('click', resetGame);

    // Initial render
    updateDisplay();

    console.log('Claude Code: The Game');
    console.log('Dev tools available: window.dev');
    console.log('  dev.showState() - show full state');
    console.log('  dev.addMoney(1000) - add money');
    console.log('  dev.addCodebase(50) - add codebase');
    console.log('  dev.setWeek(10) - jump to week');
    console.log('  dev.fastForward(4) - advance weeks');
    console.log('  dev.setFlag("hasShipped", true) - set story flag');
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
