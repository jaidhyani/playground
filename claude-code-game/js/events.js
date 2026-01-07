/**
 * Events & Narrative - Story progression and weekly events
 */

import { gameState } from './state.js';
import { updateDisplay, renderEvents, showGameOver } from './render.js';

export function addEvent(message, type = 'neutral') {
    gameState.narrative.events.unshift({
        message,
        type,
        timestamp: Date.now()
    });

    // Keep last 20 events
    if (gameState.narrative.events.length > 20) {
        gameState.narrative.events = gameState.narrative.events.slice(0, 20);
    }

    renderEvents();
}

export function checkNarrativeTriggers() {
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

// Available tech trends
const techTrends = ['ai', 'web3', 'vr', 'mobile', 'devtools', 'saas', 'cli'];

function rotateTrendingTech() {
    const currentTrend = gameState.trendingTech;
    let newTrend;

    // Pick a different trend
    do {
        newTrend = techTrends[Math.floor(Math.random() * techTrends.length)];
    } while (newTrend === currentTrend && techTrends.length > 1);

    gameState.trendingTech = newTrend;

    const techLabels = {
        'ai': 'AI/ML',
        'web3': 'Web3/Crypto',
        'vr': 'VR/AR',
        'mobile': 'Mobile',
        'devtools': 'Developer Tools',
        'saas': 'SaaS',
        'cli': 'CLI Tools'
    };

    // Notify player if their project matches the new trend
    if (gameState.projectTech === newTrend) {
        addEvent(`🔥 ${techLabels[newTrend]} is trending! Your project is in the spotlight.`, 'success');
    } else if (gameState.projectTech) {
        addEvent(`Trend shift: ${techLabels[newTrend]} is now hot. Your ${techLabels[gameState.projectTech] || 'project'} feels less exciting.`, 'neutral');
    } else {
        addEvent(`Industry buzz: ${techLabels[newTrend]} is the new hotness.`, 'neutral');
    }
}

// Real-time random events (called periodically from tick)
export function generateRandomEvent() {
    const { flags, branch } = gameState.narrative;
    const { money, codebase, energy } = gameState.resources;
    const roll = Math.random();

    // Early game flavor events (low codebase)
    if (codebase < 20 && roll > 0.6) {
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

    // Burnout events - low energy has consequences
    if (energy < 20 && roll > 0.4) {
        const burnoutEvents = [
            { msg: "You stared at the screen for an hour. Nothing happened. You can't focus.", effect: 'productivity' },
            { msg: "You snapped at someone online. Not your finest moment.", effect: 'reputation' },
            { msg: "You made a commit at 3am. It broke everything. You didn't notice until morning.", effect: 'bugs' },
            { msg: "You skipped a workout again. The chair is winning.", effect: 'none' },
            { msg: "You forgot to eat. Your body is protesting.", effect: 'none' }
        ];
        const event = burnoutEvents[Math.floor(Math.random() * burnoutEvents.length)];
        addEvent(event.msg, 'warning');

        if (event.effect === 'reputation') {
            gameState.resources.reputation = Math.max(0, gameState.resources.reputation - 2);
        } else if (event.effect === 'bugs') {
            gameState.narrative.flags.bugsInCodebase = (gameState.narrative.flags.bugsInCodebase || 0) + 1;
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

// Competitor names for flavor
const competitorNames = [
    'ByteForge', 'CodeCraft', 'DevStream', 'HackStack', 'NeonCode',
    'PixelPush', 'QuantumBit', 'RapidDev', 'SwiftShip', 'TechTonic'
];

// Called periodically from tick
export function updateCompetitorTick() {
    // Spawn competitor after player has some traction
    if (!gameState.competitor && gameState.resources.githubStars >= 30) {
        const name = competitorNames[Math.floor(Math.random() * competitorNames.length)];
        gameState.competitor = {
            name,
            stars: Math.floor(gameState.resources.githubStars * 0.6),
            momentum: 1 + Math.random() * 0.5,  // Growth multiplier
            tech: gameState.projectTech || 'devtools'
        };
        addEvent(`You notice a new project called "${name}" doing something similar. They're getting attention.`, 'warning');
        return;
    }

    if (!gameState.competitor) return;

    // Competitor grows each week
    const comp = gameState.competitor;
    const baseGrowth = Math.floor(comp.stars * 0.03 * comp.momentum);
    const trendBonus = comp.tech === gameState.trendingTech ? 2 : 0;
    comp.stars += baseGrowth + trendBonus + Math.floor(Math.random() * 5);

    // Random competitor events
    if (Math.random() < 0.15) {
        const compEvents = [
            { msg: `${comp.name} just raised a seed round. They're hiring.`, starBoost: 20 },
            { msg: `${comp.name} got featured on Product Hunt. The comments are comparing you two.`, starBoost: 15 },
            { msg: `Someone made a "vs" post: your project vs ${comp.name}. The debate is heated.`, starBoost: 5 },
            { msg: `${comp.name} shipped a feature you were planning. Beat you to it.`, starBoost: 10 },
            { msg: `A popular dev tweeted about ${comp.name}. Your mentions are quiet.`, starBoost: 8 }
        ];
        const event = compEvents[Math.floor(Math.random() * compEvents.length)];
        comp.stars += event.starBoost;
        addEvent(event.msg, 'warning');
    }

    // Player ahead - competitor loses momentum
    if (gameState.resources.githubStars > comp.stars * 1.5) {
        comp.momentum = Math.max(0.5, comp.momentum - 0.1);
        if (Math.random() < 0.1) {
            addEvent(`${comp.name} seems to be slowing down. Maybe they lost focus?`, 'neutral');
        }
    }

    // Competitor ahead - player feels pressure
    if (comp.stars > gameState.resources.githubStars * 1.5 && Math.random() < 0.2) {
        addEvent(`${comp.name} has ${comp.stars} stars now. You have ${gameState.resources.githubStars}. The gap is growing.`, 'warning');
    }

    // Big milestone events
    if (comp.stars >= 1000 && !gameState.narrative.flags.compHit1k) {
        gameState.narrative.flags.compHit1k = true;
        addEvent(`${comp.name} just hit 1000 stars. They posted a celebration thread. It stings.`, 'negative');
    }
}

export function triggerGameOver(reason) {
    gameState.narrative.flags.gameOver = true;
    gameState.narrative.flags.gameOverReason = reason;

    if (reason === 'broke') {
        addEvent("You couldn't make rent. The dream is over, for now. Maybe you'll try again someday.", 'negative');
    }

    showGameOver();
}
