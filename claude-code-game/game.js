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
        codebase: 0,       // Quality/size of your work
        techDebt: 0,       // Accumulated shortcuts and hacks (bad!)
        reputation: 0      // Your standing in the dev community (0-100)
    },

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
        week: 1,                   // Time progression
        monthlyRent: 1500          // The grind is real
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

// ============================================================================
// PR GENERATION - Vibe coding creates PRs
// ============================================================================

const prTitles = {
    good: [
        "Add responsive dashboard layout",
        "Implement user authentication flow",
        "Create API endpoint for data sync",
        "Add dark mode support",
        "Optimize database queries",
        "Implement caching layer",
        "Add export to CSV feature",
        "Create settings page",
        "Add keyboard shortcuts",
        "Implement undo/redo system"
    ],
    mediocre: [
        "Fix button alignment",
        "Update dependencies",
        "Refactor utils.js",
        "Add loading spinner",
        "Fix typo in header",
        "Update README",
        "Add console.log for debugging",
        "Rename variables for clarity",
        "Move CSS to separate file",
        "Add TODO comments"
    ],
    bad: [
        "WIP: something",
        "fix stuff",
        "asdfasdf",
        "BROKEN - DO NOT MERGE",
        "test commit please ignore",
        "idk what this does but it works",
        "3am commit",
        "aaaaaaaaaaa",
        "revert revert revert",
        "I'll fix this later"
    ]
};

let prIdCounter = 1;

function generatePR(quality) {
    const titlePool = quality > 0.7 ? prTitles.good :
                      quality > 0.3 ? prTitles.mediocre : prTitles.bad;

    const hasBug = Math.random() > (0.5 + quality * 0.3); // Better PRs less likely to have bugs
    const codebaseGain = quality > 0.7 ? Math.floor(8 + Math.random() * 7) :
                         quality > 0.3 ? Math.floor(3 + Math.random() * 4) :
                         Math.floor(1 + Math.random() * 2);

    return {
        id: prIdCounter++,
        title: titlePool[Math.floor(Math.random() * titlePool.length)],
        quality: quality,
        hasBug: hasBug,
        codebaseGain: codebaseGain,
        linesAdded: Math.floor(20 + quality * 200 + Math.random() * 100),
        linesRemoved: Math.floor(5 + quality * 50 + Math.random() * 30)
    };
}

function mergePR(prId) {
    const prIndex = gameState.prQueue.findIndex(pr => pr.id === prId);
    if (prIndex === -1) return;

    const pr = gameState.prQueue[prIndex];
    gameState.prQueue.splice(prIndex, 1);

    gameState.resources.codebase += pr.codebaseGain;

    // Low quality PRs add tech debt
    if (pr.quality < 0.5) {
        const debtAdded = Math.floor((1 - pr.quality) * 5);
        gameState.resources.techDebt += debtAdded;
    }

    if (pr.hasBug) {
        gameState.narrative.flags.bugsInCodebase = (gameState.narrative.flags.bugsInCodebase || 0) + 1;
        // Bug might be discovered later...
    }

    // Update event message based on quality
    if (pr.quality > 0.7) {
        addEvent(`Merged: "${pr.title}" (+${pr.codebaseGain} codebase) - Clean code!`, 'success');
    } else if (pr.quality > 0.4) {
        addEvent(`Merged: "${pr.title}" (+${pr.codebaseGain} codebase)`, 'neutral');
    } else {
        addEvent(`Merged: "${pr.title}" (+${pr.codebaseGain} codebase) - This might come back to haunt you...`, 'negative');
    }

    updateDisplay();
}

function rejectPR(prId) {
    const prIndex = gameState.prQueue.findIndex(pr => pr.id === prId);
    if (prIndex === -1) return;

    const pr = gameState.prQueue[prIndex];
    gameState.prQueue.splice(prIndex, 1);

    addEvent(`Rejected: "${pr.title}"`, 'neutral');
    updateDisplay();
}

// ============================================================================
// ACTIONS - What the player can do
// ============================================================================

const actions = {
    // Manual coding - requires multiple clicks to generate a PR
    code: {
        id: 'code',
        name: 'Code',
        description: 'Write code manually. Click multiple times to complete a feature.',
        cost: { energy: 5 },  // Small energy cost per click
        execute: () => {
            // Track clicks for upgrade trigger
            gameState.narrative.flags.manualCodeClicks = (gameState.narrative.flags.manualCodeClicks || 0) + 1;

            const progressPerClick = 100 / gameState.codingClicksNeeded;
            gameState.codingProgress += progressPerClick;

            // Check if we've completed a PR
            if (gameState.codingProgress >= 100) {
                gameState.codingProgress = 0;
                const quality = 0.3 + Math.random() * 0.4; // Manual coding is medium quality
                const pr = generatePR(quality);
                gameState.prQueue.push(pr);

                addEvent(`Finished coding: "${pr.title}"`, 'neutral');

                if (gameState.settings.autoMergePRs) {
                    mergePR(pr.id);
                }
                checkNarrativeTriggers();
            }
            updateDisplay();
        },
        available: () => !hasUpgrade('vibeCode'), // Hidden once you unlock vibe coding
        showProgress: true  // Flag to show progress bar
    },

    // Vibe coding - one click generates a PR (unlocked via upgrade)
    vibeCode: {
        id: 'vibeCode',
        name: 'Vibe Code',
        description: 'Start something new. No plan, just vibes. Generates a PR to review.',
        cost: { time: 20, energy: 30 },
        execute: () => {
            const quality = Math.random();

            // Generate a PR
            const pr = generatePR(quality);
            gameState.prQueue.push(pr);

            if (quality > 0.7) {
                addEvent(`Flow state! Created PR: "${pr.title}"`, 'success');
            } else if (quality > 0.3) {
                addEvent(`Made progress. Created PR: "${pr.title}"`, 'neutral');
            } else {
                addEvent(`Struggled today. Created PR: "${pr.title}"`, 'negative');
            }

            // Auto-merge if setting enabled
            if (gameState.settings.autoMergePRs) {
                mergePR(pr.id);
            }

            checkNarrativeTriggers();
        },
        available: () => hasUpgrade('vibeCode') // Only available after upgrade
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
            const improvement = Math.floor(Math.min(10, gameState.resources.codebase * 0.2));
            gameState.resources.codebase += improvement;

            // Also reduces tech debt
            const debtReduced = Math.min(gameState.resources.techDebt, 3);
            gameState.resources.techDebt -= debtReduced;

            if (debtReduced > 0) {
                addEvent(`Refactored and improved the codebase. (+${improvement} codebase, -${debtReduced} tech debt)`, 'success');
            } else {
                addEvent(`Polished and improved the codebase. (+${improvement} codebase)`, 'success');
            }

            // Iteration builds craft mastery if on bootstrap path
            if (gameState.pathResources.craftMastery !== null) {
                gameState.pathResources.craftMastery += 1;
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 10
    },

    refactor: {
        id: 'refactor',
        name: 'Deep Refactor',
        description: 'Burn it down and rebuild it right. Expensive but sometimes necessary.',
        cost: { time: 25, energy: 35 },
        execute: () => {
            const debtBefore = gameState.resources.techDebt;
            const debtReduced = Math.min(debtBefore, Math.floor(debtBefore * 0.5) + 5);
            gameState.resources.techDebt -= debtReduced;

            // Small chance of breaking something
            if (Math.random() < 0.15) {
                const codebaseLost = Math.floor(gameState.resources.codebase * 0.1);
                gameState.resources.codebase -= codebaseLost;
                addEvent(`Deep refactor complete. (-${debtReduced} tech debt) But... you broke something. (-${codebaseLost} codebase)`, 'negative');
            } else {
                addEvent(`Deep refactor complete. The codebase is much cleaner now. (-${debtReduced} tech debt)`, 'success');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.techDebt >= 5
    },

    freelance: {
        id: 'freelance',
        name: 'Freelance Gig',
        description: 'Take contract work. Pay depends on your reputation and the client.',
        cost: { time: 30, energy: 40 },
        execute: () => {
            // Different client types with different characteristics
            const clients = [
                { name: 'startup', pay: [150, 250], description: 'Quick startup gig', repGain: 1, hassle: 0.1 },
                { name: 'enterprise', pay: [300, 500], description: 'Enterprise contract', repGain: 2, hassle: 0.3, minRep: 10 },
                { name: 'agency', pay: [200, 350], description: 'Agency project', repGain: 1, hassle: 0.2 },
                { name: 'friend', pay: [50, 150], description: 'Helped a friend\'s startup', repGain: 3, hassle: 0 },
                { name: 'nightmare', pay: [400, 600], description: 'Nightmare client', repGain: 0, hassle: 0.6, energyDrain: 20 }
            ];

            // Filter by reputation requirements
            const availableClients = clients.filter(c => !c.minRep || gameState.resources.reputation >= c.minRep);
            const client = availableClients[Math.floor(Math.random() * availableClients.length)];

            // Calculate pay (reputation bonus)
            const repBonus = 1 + (gameState.resources.reputation / 100);
            const basePay = client.pay[0] + Math.floor(Math.random() * (client.pay[1] - client.pay[0]));
            const finalPay = Math.floor(basePay * repBonus);

            gameState.resources.money += finalPay;
            gameState.resources.reputation = Math.min(100, gameState.resources.reputation + client.repGain);

            // Extra energy drain for nightmare clients
            if (client.energyDrain) {
                gameState.resources.energy = Math.max(0, gameState.resources.energy - client.energyDrain);
            }

            // Hassle factor - might have issues
            if (Math.random() < client.hassle) {
                const hassleEvents = [
                    "Client asked for 'just one more revision'. It was not just one.",
                    "Scope creep struck again. You finished anyway, somehow.",
                    "They paid late. Classic.",
                    "The requirements changed three times. You adapted."
                ];
                addEvent(hassleEvents[Math.floor(Math.random() * hassleEvents.length)], 'warning');
            }

            addEvent(`${client.description}. $${finalPay} earned.${client.repGain > 1 ? ` (+${client.repGain} reputation)` : ''}`, 'neutral');

            // Small chance of insight
            if (Math.random() > 0.8) {
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

    network: {
        id: 'network',
        name: 'Network',
        description: 'Go to a meetup, post on Twitter, engage with the community. Build your reputation.',
        cost: { time: 15, energy: 20 },
        execute: () => {
            const activities = [
                { msg: "You attended a tech meetup. Made some connections, got a few business cards.", repGain: 2 },
                { msg: "You posted a technical thread on Twitter. It did... okay. A few likes.", repGain: 1 },
                { msg: "You helped someone on Stack Overflow. Feels good to give back.", repGain: 2 },
                { msg: "You commented on a popular HN thread. Someone agreed with you!", repGain: 1 },
                { msg: "You joined a Discord for indie hackers. Good vibes.", repGain: 1 },
                { msg: "You streamed some coding. Three viewers! All bots probably, but still.", repGain: 1 },
                { msg: "You wrote a blog post about something you learned. It got shared!", repGain: 3 },
                { msg: "You gave feedback on someone's project. They were grateful.", repGain: 2 }
            ];

            // Higher chance of good outcomes as reputation grows
            const goodOutcomeChance = 0.3 + (gameState.resources.reputation / 200);
            const activity = activities[Math.floor(Math.random() * activities.length)];

            // Sometimes networking leads to opportunities
            if (Math.random() < goodOutcomeChance) {
                const bonuses = [
                    { msg: "Someone reached out about a collaboration!", bonus: 'collab' },
                    { msg: "A potential client saw your work!", bonus: 'money', amount: 50 },
                    { msg: "You got a follower who's actually relevant!", bonus: 'rep', amount: 2 }
                ];
                const bonus = bonuses[Math.floor(Math.random() * bonuses.length)];
                if (bonus.bonus === 'money') gameState.resources.money += bonus.amount;
                if (bonus.bonus === 'rep') activity.repGain += bonus.amount;
                addEvent(bonus.msg, 'success');
            }

            gameState.resources.reputation = Math.min(100, gameState.resources.reputation + activity.repGain);
            addEvent(`${activity.msg} (+${activity.repGain} reputation)`, 'neutral');
            checkNarrativeTriggers();
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

    vibeCode: {
        id: 'vibeCode',
        name: 'Vibe Coding',
        description: 'You\'ve been clicking that code button a lot. Your friend mentions this AI coding tool that\'s "actually good now." You\'re skeptical - you\'ve seen the hallucinations, the bugs, the confidently wrong suggestions. But the promise is tempting: one click, one PR. Let the machine handle the grunt work.',
        cost: { money: 20 },  // API subscription
        decisions: [
            {
                id: 'embrace',
                label: 'Embrace the future',
                effect: () => {
                    gameState.codingProgress = 0;
                    gameState.narrative.flags.aiEnthusiast = true;
                    addEvent("You signed up. The first PR it generates is... surprisingly good? This changes things.", 'success');
                }
            },
            {
                id: 'cautious',
                label: 'Try it, but stay vigilant',
                effect: () => {
                    gameState.codingProgress = 0;
                    gameState.narrative.flags.aiCautious = true;
                    addEvent("You'll use it, but you're reviewing every line. Trust, but verify.", 'neutral');
                }
            },
            {
                id: 'hybrid',
                label: 'Use it for boilerplate only',
                effect: () => {
                    gameState.codingProgress = 0;
                    gameState.narrative.flags.aiHybrid = true;
                    // Hybrid approach: slightly slower but more controlled
                    gameState.codingClicksNeeded = 5; // Reduce clicks needed for manual
                    addEvent("You'll let it handle the boring stuff. The real logic stays in your hands.", 'neutral');
                }
            }
        ],
        condition: () => {
            const hasCodedManually = gameState.narrative.flags.manualCodeClicks >= 5;
            return hasCodedManually && !hasUpgrade('vibeCode');
        }
    },

    autoMerge: {
        id: 'autoMerge',
        name: 'Auto-Merge PRs',
        description: 'Reviewing every PR is getting tedious. You could set up a CI pipeline that auto-merges when tests pass. It\'d save time, but you\'d lose that hands-on review. What if something slips through?',
        cost: { time: 15, energy: 20 },
        decisions: [
            {
                id: 'full',
                label: 'Full auto-merge',
                effect: () => {
                    gameState.settings.autoMergePRs = true;
                    addEvent("Auto-merge enabled. PRs now merge automatically. Speed over safety.", 'neutral');
                }
            },
            {
                id: 'smart',
                label: 'Smart auto-merge (high quality only)',
                effect: () => {
                    gameState.settings.smartAutoMerge = true;
                    addEvent("Smart merge enabled. Only clean PRs auto-merge. Questionable ones still need review.", 'success');
                }
            },
            {
                id: 'batch',
                label: 'Batch review mode',
                effect: () => {
                    gameState.settings.batchReview = true;
                    addEvent("Batch mode enabled. PRs pile up, then you review them all at once.", 'neutral');
                }
            }
        ],
        condition: () => gameState.prQueue.length >= 3 && !hasUpgrade('autoMerge')
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

    // Bug discovery events (hidden bugs from PRs manifest)
    const hiddenBugs = flags.bugsInCodebase || 0;
    if (hiddenBugs > 0 && Math.random() < 0.15 * hiddenBugs) {
        const bugEvents = [
            { msg: "A user reported a crash. You traced it to code you merged last week. Oops.", severity: 1 },
            { msg: "Something broke in production. You're not sure when it started breaking.", severity: 2 },
            { msg: "Edge case discovered! The fix took all day. Should have written tests.", severity: 1 },
            { msg: "The bug was in the AI-generated code. At least you can blame the machine.", severity: 1 },
            { msg: "Critical bug found. Users are upset. You're upset. Everyone's upset.", severity: 3 }
        ];
        const event = bugEvents[Math.floor(Math.random() * bugEvents.length)];
        addEvent(event.msg, 'negative');
        gameState.narrative.flags.bugsInCodebase = Math.max(0, hiddenBugs - 1);
        gameState.resources.techDebt += event.severity;

        // Severe bugs can cost codebase quality
        if (event.severity >= 2) {
            const codebaseLost = Math.floor(event.severity * 2);
            gameState.resources.codebase = Math.max(0, gameState.resources.codebase - codebaseLost);
        }
        return;
    }

    // High tech debt events
    const { techDebt } = gameState.resources;
    if (techDebt >= 10 && roll > 0.6) {
        const debtEvents = [
            { msg: "Adding a simple feature took three times longer than expected. Tech debt strikes again.", energyLoss: 15 },
            { msg: "You tried to understand code you wrote last month. You couldn't. The debt compounds.", energyLoss: 10 },
            { msg: "A 'quick fix' turned into a four-hour refactoring session. The shortcuts caught up.", energyLoss: 20 },
            { msg: "New feature? First you need to untangle the spaghetti from two sprints ago.", energyLoss: 10 }
        ];
        const event = debtEvents[Math.floor(Math.random() * debtEvents.length)];
        addEvent(event.msg, 'warning');
        gameState.resources.energy = Math.max(0, gameState.resources.energy - event.energyLoss);
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
    renderPRs();
    renderUpgrades();
    renderPathResources();
}

// Track previous values for change detection
let previousResources = { ...gameState.resources };

function renderResources() {
    const resources = ['money', 'time', 'energy', 'codebase', 'techDebt', 'reputation'];

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
            // For tech debt, down is good, up is bad (inverted)
            if (key === 'techDebt') {
                el.classList.add(currentValue < previousValue ? 'flash-up' : 'flash-down');
            } else {
                el.classList.add(currentValue > previousValue ? 'flash-up' : 'flash-down');
            }
        }
    });

    document.getElementById('week').textContent = gameState.narrative.week;

    // Show/hide tech debt display
    const techDebtDisplay = document.getElementById('tech-debt-display');
    if (techDebtDisplay) {
        techDebtDisplay.style.display = gameState.resources.techDebt > 0 ? 'flex' : 'none';
    }

    // Show/hide reputation display
    const reputationDisplay = document.getElementById('reputation-display');
    if (reputationDisplay) {
        reputationDisplay.style.display = gameState.resources.reputation > 0 ? 'flex' : 'none';
    }

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

        // Show progress bar for manual coding
        let progressBar = '';
        if (action.showProgress && gameState.codingProgress > 0) {
            progressBar = `
                <div class="coding-progress-container">
                    <div class="coding-progress-bar" style="width: ${gameState.codingProgress}%"></div>
                    <span class="coding-progress-text">${Math.floor(gameState.codingProgress)}%</span>
                </div>
            `;
        }

        html += `
            <div class="action-card ${canAfford ? '' : 'disabled'}" onclick="${canAfford ? `executeAction('${action.id}')` : ''}">
                <div class="action-name">${action.name}</div>
                <div class="action-description">${action.description}</div>
                ${progressBar}
                ${costItems ? `<div class="action-cost">${costItems}</div>` : ''}
            </div>
        `;
    }

    container.innerHTML = html || '<p class="no-upgrades">No actions available right now.</p>';
}

function renderPRs() {
    const container = document.getElementById('pr-list');
    const countEl = document.getElementById('pr-count');
    if (!container) return;

    if (countEl) {
        countEl.textContent = gameState.prQueue.length > 0 ? `(${gameState.prQueue.length})` : '';
    }

    if (gameState.prQueue.length === 0) {
        container.innerHTML = '<div class="no-prs">No PRs to review. Vibe code to create some!</div>';
        return;
    }

    let html = '';

    for (const pr of gameState.prQueue) {
        const qualityClass = pr.quality > 0.7 ? 'quality-good' :
                             pr.quality > 0.3 ? 'quality-medium' : 'quality-bad';

        html += `
            <div class="pr-card ${qualityClass}">
                <div class="pr-title">${pr.title}</div>
                <div class="pr-stats">
                    <span class="pr-stat added">+${pr.linesAdded}</span>
                    <span class="pr-stat removed">-${pr.linesRemoved}</span>
                </div>
                <div class="pr-gain">+${pr.codebaseGain} codebase</div>
                <div class="pr-actions">
                    <button class="pr-merge-btn" onclick="mergePR(${pr.id})">Merge</button>
                    <button class="pr-reject-btn" onclick="rejectPR(${pr.id})">Reject</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
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
            const parsed = JSON.parse(saved);
            Object.assign(gameState, parsed);
            gameState.lastTick = Date.now();

            // Migration: ensure new resource fields exist with defaults
            if (gameState.resources.techDebt === undefined || gameState.resources.techDebt === null) {
                gameState.resources.techDebt = 0;
            }
            if (gameState.resources.reputation === undefined || gameState.resources.reputation === null) {
                gameState.resources.reputation = 0;
            }

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
