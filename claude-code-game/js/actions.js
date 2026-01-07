/**
 * Actions - What the player can do each week
 */

import { gameState, hasUpgrade } from './state.js';
import { generatePR, mergePR } from './prs.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';

export const actions = {
    code: {
        id: 'code',
        name: 'code',
        description: '',
        cost: { energy: 5 },
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

    vibeCode: {
        id: 'vibeCode',
        name: 'vibe',
        description: '',
        cost: { energy: 25 },
        execute: () => {
            let quality = Math.random();

            // Trending tech bonus - building in a hot area increases quality
            if (gameState.projectTech && gameState.projectTech === gameState.trendingTech) {
                quality = Math.min(1, quality + 0.15);
            }

            // Generate a PR
            const pr = generatePR(quality);

            // AI assistant bonus - multiply codebase gains
            const aiEffect = gameState.passiveEffects.find(e => e.id === 'aiAssist');
            if (aiEffect?.codebaseMultiplier) {
                pr.codebaseGain = Math.floor(pr.codebaseGain * aiEffect.codebaseMultiplier);
            }

            gameState.prQueue.push(pr);

            if (quality > 0.7) {
                addEvent(`Flow state! Created PR: "${pr.title}"`, 'success');
            } else if (quality > 0.3) {
                addEvent(`Made progress. Created PR: "${pr.title}"`, 'neutral');
            } else {
                addEvent(`Struggled today. Created PR: "${pr.title}"`, 'negative');
            }

            // Auto-merge logic
            if (gameState.settings.autoMergePRs) {
                mergePR(pr.id);
            } else if (gameState.settings.smartAutoMerge && pr.quality > 0.6) {
                // Smart auto-merge only merges good PRs
                mergePR(pr.id);
                addEvent('Smart merge: Auto-merged clean PR.', 'neutral');
            }

            checkNarrativeTriggers();
        },
        available: () => hasUpgrade('vibeCode') // Only available after upgrade
    },

    iterate: {
        id: 'iterate',
        name: 'iterate',
        description: '',
        cost: { energy: 20 },
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
        name: 'refactor',
        description: '',
        cost: { energy: 35 },
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
        name: 'freelance',
        description: '',
        cost: { energy: 40 },
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
        available: () => gameState.resources.codebase >= 10  // Unlock after you've built something
    },

    rest: {
        id: 'rest',
        name: 'rest',
        description: '',
        cost: {},
        execute: () => {
            gameState.resources.energy = Math.min(100, gameState.resources.energy + 40);
            const messages = [
                "You went for a walk. Touched grass. It helped.",
                "You binged a show. Sometimes that's necessary.",
                "You cooked a real meal for once. Felt human.",
                "You called a friend. Remembered there's a world outside code.",
                "You took a nap. Woke up confused but refreshed.",
                "You did some stretches. Your back thanked you.",
                "You played a video game. Productivity, but different.",
                "You read a book. An actual paper book. Revolutionary.",
                "You sat in silence for a while. It was weird but good.",
                "You cleaned your desk. Found three cables you forgot about.",
                "You went to a coffee shop and didn't open your laptop. Growth.",
                "You watched the sunset. When did you last do that?"
            ];
            addEvent(messages[Math.floor(Math.random() * messages.length)], 'neutral');
        },
        available: () => gameState.resources.codebase > 0  // Unlock after first PR merged
    },

    // Removed endWeek - no longer needed with real-time system

    network: {
        id: 'network',
        name: 'network',
        description: '',
        cost: { energy: 20 },
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
        available: () => gameState.resources.codebase >= 20  // Unlock when you have something to show
    },

    ship: {
        id: 'ship',
        name: 'ship',
        description: '',
        cost: { energy: 50 },
        execute: () => {
            if (gameState.resources.codebase < 30) {
                addEvent("You're not ready to ship. Deep down, you know it. Keep building.", 'negative');
                return;
            }

            // Shipping is a big deal
            gameState.narrative.flags.hasShipped = true;
            const quality = gameState.resources.codebase;
            const techDebtPenalty = gameState.resources.techDebt * 2;
            const effectiveQuality = Math.max(0, quality - techDebtPenalty);

            // Calculate initial users based on quality and reputation
            const repBonus = 1 + (gameState.resources.reputation / 50);
            let initialUsers = Math.floor(effectiveQuality * repBonus / 10);

            // Tech debt affects launch negatively
            if (gameState.resources.techDebt > 10) {
                addEvent("Launch day! But... there are bugs. A lot of bugs. Users are reporting crashes.", 'warning');
                initialUsers = Math.floor(initialUsers * 0.5);
            }

            gameState.narrative.flags.users = initialUsers;

            if (effectiveQuality >= 70) {
                addEvent(`You shipped! ${initialUsers} people signed up on day one. This might be the start of something.`, 'success');
                gameState.narrative.flags.successfulLaunch = true;
                gameState.resources.reputation += 5;
                // Start passive income
                gameState.passiveEffects.push({
                    id: 'productRevenue',
                    description: 'Product revenue',
                    weeklyIncome: Math.floor(initialUsers * 0.5)
                });
            } else if (effectiveQuality >= 40) {
                addEvent(`You shipped. ${initialUsers} people tried it. The feedback is mixed but useful.`, 'neutral');
                gameState.resources.reputation += 2;
                gameState.passiveEffects.push({
                    id: 'productRevenue',
                    description: 'Product revenue',
                    weeklyIncome: Math.floor(initialUsers * 0.3)
                });
            } else {
                addEvent(`You shipped. ${initialUsers || 'A handful of'} downloads. Crickets. It stings.`, 'negative');
                gameState.resources.reputation += 1;
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 30 && !gameState.narrative.flags.hasShipped
    },

    releaseUpdate: {
        id: 'releaseUpdate',
        name: 'release',
        description: '',
        cost: { energy: 40 },
        execute: () => {
            const codebaseGain = gameState.resources.codebase - (gameState.narrative.flags.lastReleaseCodebase || 0);

            if (codebaseGain < 20) {
                addEvent("Not enough new features to justify an update. Keep building.", 'neutral');
                return;
            }

            gameState.narrative.flags.lastReleaseCodebase = gameState.resources.codebase;
            gameState.narrative.flags.releaseCount = (gameState.narrative.flags.releaseCount || 0) + 1;

            // Updates bring back users and attract new ones
            const currentUsers = gameState.narrative.flags.users || 0;
            const newUsers = Math.floor(codebaseGain * 0.5 + currentUsers * 0.1);
            gameState.narrative.flags.users = currentUsers + newUsers;

            // Boost stars
            const starGain = Math.floor(newUsers * 0.3);
            gameState.resources.githubStars += starGain;

            // Update revenue
            const revenueEffect = gameState.passiveEffects.find(e => e.id === 'productRevenue');
            if (revenueEffect) {
                revenueEffect.weeklyIncome += Math.floor(newUsers * 0.2);
            }

            addEvent(`v${gameState.narrative.flags.releaseCount + 1}.0 released! ${newUsers} new users, +${starGain} stars. The changelog thread got some engagement.`, 'success');
            gameState.resources.reputation += 2;
            checkNarrativeTriggers();
        },
        available: () => gameState.narrative.flags.hasShipped && gameState.resources.codebase >= 50
    },

    market: {
        id: 'market',
        name: 'promote',
        description: '',
        cost: { energy: 25, money: 50 },
        execute: () => {
            const currentUsers = gameState.narrative.flags.users || 0;
            const repBonus = 1 + (gameState.resources.reputation / 100);
            const newUsers = Math.floor((5 + Math.random() * 15) * repBonus);

            gameState.narrative.flags.users = currentUsers + newUsers;
            gameState.resources.reputation += 1;

            // Update passive income
            const revenueEffect = gameState.passiveEffects.find(e => e.id === 'productRevenue');
            if (revenueEffect) {
                revenueEffect.weeklyIncome = Math.floor(gameState.narrative.flags.users * 0.4);
            }

            const messages = [
                `Posted on Product Hunt. ${newUsers} new users!`,
                `Ran a small ad campaign. ${newUsers} signups.`,
                `A tweet went mini-viral. ${newUsers} people checked it out.`,
                `Wrote a "Show HN" post. ${newUsers} curious devs signed up.`
            ];
            addEvent(messages[Math.floor(Math.random() * messages.length)], 'success');
            checkNarrativeTriggers();
        },
        available: () => gameState.narrative.flags.hasShipped
    },

    support: {
        id: 'support',
        name: 'support',
        description: '',
        cost: { energy: 20 },
        execute: () => {
            const users = gameState.narrative.flags.users || 0;
            const issueCount = Math.floor(1 + Math.random() * (users / 10));

            // Good support builds reputation and reduces churn
            gameState.resources.reputation += 2;

            // Small chance of feature request leading to codebase improvement
            if (Math.random() > 0.7) {
                gameState.resources.codebase += 2;
                addEvent(`Answered ${issueCount} support tickets. One user's feedback gave you a great idea!`, 'success');
            } else {
                addEvent(`Handled ${issueCount} support requests. Users appreciate the personal touch.`, 'neutral');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.narrative.flags.hasShipped && (gameState.narrative.flags.users || 0) > 5
    },

    postToHN: {
        id: 'postToHN',
        name: 'post to HN',
        description: '',
        cost: { energy: 30 },
        execute: () => {
            const roll = Math.random();
            const repBonus = gameState.resources.reputation / 100;
            const qualityBonus = gameState.resources.codebase / 200;
            const isTrending = gameState.projectTech === gameState.trendingTech;
            const trendBonus = isTrending ? 0.15 : 0;

            const successChance = 0.1 + repBonus + qualityBonus + trendBonus;

            if (roll < successChance * 0.3) {
                // Front page! (~3-10% chance)
                const stars = Math.floor(50 + Math.random() * 150);
                const users = Math.floor(20 + Math.random() * 80);
                const money = Math.floor(100 + Math.random() * 200);

                gameState.resources.githubStars += stars;
                gameState.resources.reputation += 10;
                gameState.resources.money += money;
                gameState.narrative.flags.users = (gameState.narrative.flags.users || 0) + users;

                // Update product revenue if shipped
                const revenueEffect = gameState.passiveEffects.find(e => e.id === 'productRevenue');
                if (revenueEffect) {
                    revenueEffect.weeklyIncome = Math.floor(gameState.narrative.flags.users * 0.4);
                }

                addEvent(`🚀 FRONT PAGE! Your post hit #1 on HN. +${stars} stars, +${users} users, +$${money} in donations. Your inbox is chaos.`, 'success');
                gameState.narrative.flags.hnFrontPage = true;
            } else if (roll < successChance) {
                // Moderate success (~10-20% chance)
                const stars = Math.floor(10 + Math.random() * 30);
                const users = Math.floor(5 + Math.random() * 15);

                gameState.resources.githubStars += stars;
                gameState.resources.reputation += 3;
                gameState.narrative.flags.users = (gameState.narrative.flags.users || 0) + users;

                addEvent(`Your HN post got some traction. +${stars} stars, +${users} users. Not bad!`, 'success');
            } else if (roll > 0.9) {
                // Roasted (~10% chance)
                gameState.resources.energy = Math.max(0, gameState.resources.energy - 20);
                gameState.resources.reputation = Math.max(0, gameState.resources.reputation - 2);

                const roasts = [
                    "\"This is just a wrapper around ${POPULAR_THING}\" - 47 points",
                    "\"Why would anyone use this over ${COMPETITOR}?\" - 23 points",
                    "\"The landing page has a typo. Didn't bother trying it.\" - 89 points",
                    "\"Mass surveillance disguised as productivity\" - 156 points"
                ];
                addEvent(`HN roasted you. ${roasts[Math.floor(Math.random() * roasts.length)]}`, 'negative');
            } else {
                // Nothing happened (~60-70% chance)
                const nothingEvents = [
                    "Your post got 2 upvotes. One was you. The other was your mom.",
                    "Posted at the wrong time. Buried immediately.",
                    "Someone asked a question. You answered. They didn't reply.",
                    "A moderator changed your title to something worse."
                ];
                addEvent(nothingEvents[Math.floor(Math.random() * nothingEvents.length)], 'neutral');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 20
    },

    openSource: {
        id: 'openSource',
        name: 'open source',
        description: '',
        cost: { energy: 25 },
        execute: () => {
            const roll = Math.random();
            const stars = Math.floor(1 + Math.random() * 5);

            gameState.resources.githubStars += stars;
            gameState.resources.reputation += 1;

            if (roll > 0.8) {
                // Lucky break
                const bonuses = [
                    { msg: "Your PR got merged into a popular project! People noticed.", stars: 10, rep: 3 },
                    { msg: "A maintainer mentioned you in their newsletter.", stars: 5, rep: 2 },
                    { msg: "Someone used your code in production. They sent a thank you!", stars: 3, rep: 2 },
                    { msg: "A recruiter reached out. You politely declined.", stars: 0, rep: 1, money: 0 }
                ];
                const bonus = bonuses[Math.floor(Math.random() * bonuses.length)];
                gameState.resources.githubStars += bonus.stars;
                gameState.resources.reputation += bonus.rep;
                if (bonus.money) gameState.resources.money += bonus.money;
                addEvent(`${bonus.msg} (+${stars + bonus.stars} ⭐)`, 'success');
            } else {
                const msgs = [
                    `Fixed a bug in someone's library. +${stars} ⭐`,
                    `Added a feature to an OSS tool you use. +${stars} ⭐`,
                    `Wrote some documentation. Thankless but necessary. +${stars} ⭐`,
                    `Reviewed a PR. Gave constructive feedback. +${stars} ⭐`
                ];
                addEvent(msgs[Math.floor(Math.random() * msgs.length)], 'neutral');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 15
    }
};

export function canAffordAction(action) {
    if (!action.cost) return true;
    for (const [resource, cost] of Object.entries(action.cost)) {
        if (gameState.resources[resource] < cost) return false;
    }
    return true;
}

export function executeAction(actionId) {
    const action = actions[actionId];
    if (!action || !action.available() || !canAffordAction(action)) return;

    // Deduct costs
    for (const [resource, cost] of Object.entries(action.cost || {})) {
        gameState.resources[resource] -= cost;
    }

    action.execute();
    updateDisplay();
}

// Make executeAction globally available for onclick handlers
window.executeAction = executeAction;
