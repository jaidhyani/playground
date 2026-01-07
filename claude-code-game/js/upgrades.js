/**
 * Upgrades - Branching decisions and improvements
 */

import { gameState, hasUpgrade } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

export const upgradeDefinitions = {
    // ===== PROJECT DEFINITION =====
    projectFocus: {
        id: 'projectFocus',
        name: 'what are you building?',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'ai',
                label: 'ai/ml tool',
                effect: () => {
                    gameState.projectTech = 'ai';
                    addEvent("AI tool. Crowded but massive potential.", 'neutral');
                }
            },
            {
                id: 'devtools',
                label: 'dev tools',
                effect: () => {
                    gameState.projectTech = 'devtools';
                    addEvent("Dev tools. Niche but devs pay for good tools.", 'neutral');
                }
            },
            {
                id: 'saas',
                label: 'saas',
                effect: () => {
                    gameState.projectTech = 'saas';
                    addEvent("SaaS. Recurring revenue is the dream.", 'neutral');
                }
            },
            {
                id: 'cli',
                label: 'cli tool',
                effect: () => {
                    gameState.projectTech = 'cli';
                    addEvent("CLI tool. Simple, focused, beloved.", 'neutral');
                }
            }
        ],
        condition: () => gameState.resources.codebase >= 10 && !gameState.projectTech && !hasUpgrade('projectFocus')
    },

    vibeCode: {
        id: 'vibeCode',
        name: 'vibe coding',
        description: '',
        cost: { money: 20 },
        decisions: [
            {
                id: 'embrace',
                label: 'enable ($20)',
                effect: () => {
                    gameState.codingProgress = 0;
                    addEvent("Vibe coding enabled. First PR is... surprisingly good.", 'success');
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
        name: 'auto-merge',
        description: '',
        cost: { energy: 20 },
        decisions: [
            {
                id: 'full',
                label: 'auto-merge all',
                effect: () => {
                    gameState.settings.autoMergePRs = true;
                    addEvent("Auto-merge on. Speed over safety.", 'neutral');
                }
            },
            {
                id: 'smart',
                label: 'smart merge (clean only)',
                effect: () => {
                    gameState.settings.smartAutoMerge = true;
                    addEvent("Smart merge on. Risky PRs still need review.", 'success');
                }
            },
            {
                id: 'batch',
                label: 'batch review',
                effect: () => {
                    gameState.settings.batchReview = true;
                    addEvent("Batch mode. PRs pile up, review all at once.", 'neutral');
                }
            }
        ],
        condition: () => gameState.prQueue.length >= 3 && !hasUpgrade('autoMerge')
    },

    // ===== POST-SHIP UPGRADES =====
    userAnalytics: {
        id: 'userAnalytics',
        name: 'analytics',
        description: '',
        cost: { energy: 30 },
        decisions: [
            {
                id: 'fullTracking',
                label: 'full tracking',
                effect: () => {
                    gameState.resources.codebase += 10;
                    gameState.narrative.flags.heavyTracking = true;
                    addEvent("Analytics in. You see everything.", 'neutral');
                }
            },
            {
                id: 'minimalTracking',
                label: 'privacy-first',
                effect: () => {
                    gameState.resources.codebase += 5;
                    gameState.narrative.flags.privacyFocused = true;
                    addEvent("Basic analytics. Page views, nothing personal.", 'success');
                }
            },
            {
                id: 'noTracking',
                label: 'no tracking',
                effect: () => {
                    gameState.narrative.flags.noTracking = true;
                    addEvent("No analytics. Flying blind.", 'neutral');
                }
            }
        ],
        condition: () => gameState.narrative.flags.hasShipped && !hasUpgrade('userAnalytics')
    },

    // ===== FIRST SUCCESS BRANCH =====
    firstRevenue: {
        id: 'firstRevenue',
        name: 'monetization',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'stayFree',
                label: 'stay free',
                effect: () => {
                    gameState.narrative.branch = 'bootstrap';
                    gameState.pathResources.userTrust = 80;
                    gameState.pathResources.craftMastery = 10;
                    gameState.narrative.flags.bootstrap = true;
                    addEvent("Free. Users love it. Goodwill doesn't pay rent though.", 'success');
                }
            },
            {
                id: 'freemium',
                label: 'freemium',
                effect: () => {
                    gameState.narrative.branch = 'growth_early';
                    gameState.pathResources.userTrust = 50;
                    gameState.pathResources.runway = 6;
                    gameState.narrative.flags.freemium = true;
                    addEvent("Premium tier added. Some upgrade, some complain.", 'neutral');
                }
            },
            {
                id: 'paidUpfront',
                label: 'paid upfront',
                effect: () => {
                    gameState.narrative.branch = 'bootstrap';
                    gameState.pathResources.userTrust = 60;
                    gameState.pathResources.craftMastery = 10;
                    gameState.resources.money += 200;
                    gameState.narrative.flags.paidApp = true;
                    addEvent("$5 upfront. Downloads slow but each one chose to pay.", 'success');
                }
            }
        ],
        condition: () => gameState.narrative.flags.successfulLaunch && !hasUpgrade('firstRevenue')
    },

    // ===== AI DECISION (Early) =====
    aiCodingAssistant: {
        id: 'aiCodingAssistant',
        name: 'ai assistant',
        description: '',
        cost: { money: 20 },
        recurring: true,
        decisions: [
            {
                id: 'fullIntegration',
                label: 'all in ($20/mo)',
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
                    addEvent("AI integrated. Output doubles. Is this still your code?", 'neutral');
                }
            },
            {
                id: 'carefulUse',
                label: 'careful use ($20/mo)',
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
                    addEvent("AI for boilerplate only. You review everything.", 'success');
                }
            },
            {
                id: 'reject',
                label: 'no thanks',
                effect: () => {
                    gameState.narrative.flags.aiRejected = true;
                    if (gameState.pathResources.craftMastery !== null) {
                        gameState.pathResources.craftMastery += 5;
                    }
                    addEvent("The old way still works.", 'neutral');
                }
            }
        ],
        condition: () =>
            gameState.resources.codebase >= 50 &&
            !hasUpgrade('aiCodingAssistant')
    },

    // ===== STAR-BASED UPGRADES =====
    sponsorship: {
        id: 'sponsorship',
        name: 'github sponsors',
        description: '',
        cost: { energy: 10 },
        decisions: [
            {
                id: 'setup',
                label: 'set it up',
                effect: () => {
                    const monthlySponsors = Math.floor(gameState.resources.githubStars / 50);
                    const monthlyIncome = monthlySponsors * 5;
                    gameState.passiveEffects.push({
                        id: 'sponsors',
                        description: 'GitHub Sponsors',
                        weeklyIncome: Math.floor(monthlyIncome / 4)
                    });
                    addEvent(`Sponsors enabled. ${monthlySponsors} signed up. +$${Math.floor(monthlyIncome / 4)}/wk`, 'success');
                }
            },
            {
                id: 'skip',
                label: 'feels like begging',
                effect: () => {
                    addEvent("Work should speak for itself. Right?", 'neutral');
                }
            }
        ],
        condition: () => gameState.resources.githubStars >= 100 && !hasUpgrade('sponsorship')
    },

    secondMonitor: {
        id: 'secondMonitor',
        name: 'second monitor',
        description: '',
        cost: { money: 250 },
        decisions: [
            {
                id: 'buy',
                label: 'buy ($250)',
                effect: () => {
                    gameState.narrative.flags.secondMonitor = true;
                    addEvent("Dual monitors. Real developer now.", 'success');
                }
            },
            {
                id: 'skip',
                label: 'laptop is fine',
                effect: () => {
                    addEvent("One screen got you this far.", 'neutral');
                }
            }
        ],
        condition: () => gameState.resources.money >= 300 && !hasUpgrade('secondMonitor')
    },

    testSuite: {
        id: 'testSuite',
        name: 'write tests',
        description: '',
        cost: { energy: 40 },
        decisions: [
            {
                id: 'comprehensive',
                label: 'full coverage',
                effect: () => {
                    gameState.narrative.flags.hasTests = 'comprehensive';
                    gameState.resources.codebase += 5;
                    addEvent("Tests written. Green checkmarks are satisfying.", 'success');
                }
            },
            {
                id: 'basic',
                label: 'critical paths only',
                effect: () => {
                    gameState.narrative.flags.hasTests = 'basic';
                    gameState.resources.codebase += 2;
                    addEvent("Basic tests. Important stuff covered. Probably.", 'neutral');
                }
            },
            {
                id: 'skip',
                label: 'live dangerously',
                effect: () => {
                    gameState.narrative.flags.hasTests = false;
                    addEvent("No tests. Ship it and see.", 'warning');
                }
            }
        ],
        condition: () => gameState.resources.codebase >= 40 && gameState.resources.techDebt >= 5 && !hasUpgrade('testSuite')
    },

    pivotProject: {
        id: 'pivotProject',
        name: 'pivot?',
        description: '',
        cost: { energy: 50 },
        decisions: [
            {
                id: 'pivot',
                label: 'chase the trend',
                effect: () => {
                    gameState.projectTech = gameState.trendingTech;
                    const codebaseLost = Math.floor(gameState.resources.codebase * 0.2);
                    gameState.resources.codebase -= codebaseLost;
                    addEvent(`Pivoted to ${gameState.trendingTech}. -${codebaseLost} codebase.`, 'neutral');
                }
            },
            {
                id: 'stay',
                label: 'stay the course',
                effect: () => {
                    gameState.resources.reputation += 2;
                    addEvent("Trends come and go. Good products last.", 'success');
                }
            }
        ],
        condition: () =>
            gameState.projectTech &&
            gameState.trendingTech &&
            gameState.projectTech !== gameState.trendingTech &&
            gameState.resources.codebase >= 30 &&
            !hasUpgrade('pivotProject')
    },

    // ===== STAR MILESTONE UNLOCKS =====
    starMilestone50: {
        id: 'starMilestone50',
        name: '50 stars',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'celebrate',
                label: 'tweet about it',
                effect: () => {
                    gameState.resources.reputation += 3;
                    addEvent("Tweeted about 50 stars. Some congrats. Felt nice.", 'success');
                }
            }
        ],
        condition: () => gameState.resources.githubStars >= 50 && !hasUpgrade('starMilestone50')
    },

    starMilestone500: {
        id: 'starMilestone500',
        name: '500 stars',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'acknowledge',
                label: 'getting serious',
                effect: () => {
                    gameState.resources.reputation += 10;
                    const revenueEffect = gameState.passiveEffects.find(e => e.id === 'productRevenue');
                    if (revenueEffect) {
                        revenueEffect.weeklyIncome = Math.floor(revenueEffect.weeklyIncome * 1.5);
                    }
                    addEvent("500 stars. Companies asking about enterprise.", 'success');
                }
            }
        ],
        condition: () => gameState.resources.githubStars >= 500 && !hasUpgrade('starMilestone500')
    },

    // ===== MID-GAME DECISIONS =====
    hireHelp: {
        id: 'hireHelp',
        name: 'hire help?',
        description: '',
        cost: { money: 500 },
        decisions: [
            {
                id: 'hire',
                label: 'hire contractor ($500 + $200/mo)',
                effect: () => {
                    gameState.narrative.flags.hasContractor = true;
                    gameState.passiveEffects.push({
                        id: 'contractor',
                        description: 'Contractor',
                        monthlyCost: 200,
                        weeklyCodebase: 5
                    });
                    addEvent("Hired someone. Weird seeing others touch your code.", 'success');
                }
            },
            {
                id: 'solo',
                label: 'stay solo',
                effect: () => {
                    gameState.pathResources.craftMastery = (gameState.pathResources.craftMastery || 0) + 5;
                    addEvent("Solo. Harder, but vision stays pure.", 'neutral');
                }
            }
        ],
        condition: () =>
            gameState.resources.money >= 800 &&
            gameState.resources.codebase >= 80 &&
            !hasUpgrade('hireHelp')
    },

    vcOffer: {
        id: 'vcOffer',
        name: 'vc interest',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'take',
                label: 'take the money (+$5000)',
                effect: () => {
                    gameState.narrative.branch = 'funded';
                    gameState.resources.money += 5000;
                    gameState.pathResources.runway = 24;
                    gameState.pathResources.userTrust = Math.max(20, (gameState.pathResources.userTrust || 50) - 30);
                    gameState.narrative.flags.vcFunded = true;
                    addEvent("Signed. $5000 in bank. Board seat gone.", 'neutral');
                }
            },
            {
                id: 'decline',
                label: 'stay independent',
                effect: () => {
                    gameState.resources.reputation += 5;
                    gameState.pathResources.userTrust = (gameState.pathResources.userTrust || 50) + 10;
                    addEvent("Declined. Some things aren't for sale.", 'success');
                }
            }
        ],
        condition: () =>
            gameState.resources.githubStars >= 200 &&
            gameState.resources.codebase >= 100 &&
            gameState.narrative.flags.hasShipped &&
            !hasUpgrade('vcOffer')
    },

    acquiOffer: {
        id: 'acquiOffer',
        name: 'acquisition offer',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'sell',
                label: 'sell out',
                effect: () => {
                    gameState.narrative.flags.sold = true;
                    gameState.narrative.flags.ending = 'sold';
                    import('./render.js').then(({ showGameOver }) => {
                        addEvent("Sold. Check cleared. Watching them add ads stings.", 'milestone');
                        setTimeout(() => showGameOver(), 2000);
                    });
                }
            },
            {
                id: 'refuse',
                label: 'not for sale',
                effect: () => {
                    gameState.resources.reputation += 20;
                    gameState.pathResources.userTrust = (gameState.pathResources.userTrust || 50) + 20;
                    addEvent("Said no. Community went wild.", 'success');
                }
            }
        ],
        condition: () =>
            gameState.resources.githubStars >= 1000 &&
            gameState.resources.codebase >= 150 &&
            !hasUpgrade('acquiOffer')
    },

    // ===== WIN CONDITIONS =====
    sustainableSuccess: {
        id: 'sustainableSuccess',
        name: 'sustainable',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'continue',
                label: 'keep building',
                effect: () => {
                    gameState.narrative.flags.ending = 'sustainable';
                    import('./render.js').then(({ showGameOver }) => {
                        addEvent("Made it. Not a unicorn. Just free.", 'milestone');
                        setTimeout(() => showGameOver(), 2000);
                    });
                }
            }
        ],
        condition: () => {
            const weeklyIncome = gameState.passiveEffects.reduce((sum, e) => sum + (e.weeklyIncome || 0), 0);
            const monthlyIncome = weeklyIncome * 4;
            const monthlyExpenses = gameState.narrative.monthlyRent +
                gameState.passiveEffects.reduce((sum, e) => sum + (e.monthlyCost || 0), 0);

            return monthlyIncome >= monthlyExpenses * 2 &&
                   gameState.resources.githubStars >= 500 &&
                   !gameState.narrative.flags.vcFunded &&
                   !hasUpgrade('sustainableSuccess');
        }
    },

    starMilestone2000: {
        id: 'starMilestone2000',
        name: '2000 stars',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'celebrate',
                label: 'just the beginning',
                effect: () => {
                    gameState.narrative.flags.ending = 'stardom';
                    import('./render.js').then(({ showGameOver }) => {
                        addEvent("2000 stars. You shipped something real.", 'milestone');
                        setTimeout(() => showGameOver(), 2000);
                    });
                }
            }
        ],
        condition: () => gameState.resources.githubStars >= 2000 && !hasUpgrade('starMilestone2000')
    }
};

export function canAffordUpgrade(upgrade) {
    if (!upgrade.cost) return true;
    for (const [resource, cost] of Object.entries(upgrade.cost)) {
        if (gameState.resources[resource] < cost) return false;
    }
    return true;
}

export function executeUpgradeDecision(upgradeId, decisionId) {
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

// Make executeUpgradeDecision globally available for onclick handlers
window.executeUpgradeDecision = executeUpgradeDecision;
