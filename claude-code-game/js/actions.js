/**
 * Actions - What you can do at Anthropic
 */

import { gameState, hasUpgrade } from './state.js';
import { generatePR, mergePR } from './prs.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';

export const actions = {
    code: {
        id: 'code',
        name: 'write code',
        cost: { energy: 5 },
        execute: () => {
            gameState.narrative.flags.manualCodeClicks = (gameState.narrative.flags.manualCodeClicks || 0) + 1;

            const progressPerClick = 100 / gameState.codingClicksNeeded;
            gameState.codingProgress += progressPerClick;

            if (gameState.codingProgress >= 100) {
                gameState.codingProgress = 0;
                const quality = 0.4 + Math.random() * 0.3;
                const isFirst = !gameState.narrative.flags.firstPRCreated;
                const pr = generatePR(quality, isFirst);
                gameState.narrative.flags.firstPRCreated = true;
                gameState.prQueue.push(pr);
                addEvent(`PR ready: "${pr.title}"`, 'neutral');

                if (gameState.settings.autoMergePRs) {
                    mergePR(pr.id);
                }
                checkNarrativeTriggers();
            }
            updateDisplay();
        },
        available: () => !gameState.settings.vibeMode
    },

    // Vibe coding is now an autoclicker - see main.js tick()

    refactor: {
        id: 'refactor',
        name: 'pay down debt',
        cost: { energy: 25 },
        execute: () => {
            if (gameState.resources.techDebt < 3) {
                addEvent("Codebase is clean enough.", 'neutral');
                return;
            }

            const reduced = Math.min(gameState.resources.techDebt, Math.floor(gameState.resources.techDebt * 0.4) + 2);
            gameState.resources.techDebt -= reduced;

            // Small risk of breaking something
            if (Math.random() < 0.1) {
                const lost = Math.floor(gameState.resources.codebase * 0.05);
                gameState.resources.codebase -= lost;
                addEvent(`Refactored. -${reduced} debt. Broke something. -${lost} codebase.`, 'warning');
            } else {
                addEvent(`Refactored. -${reduced} tech debt.`, 'success');
            }
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.techDebt >= 3
    },

    rest: {
        id: 'rest',
        name: 'touch grass',
        cost: {},
        execute: () => {
            gameState.resources.energy = Math.min(100, gameState.resources.energy + 30);
            const msgs = [
                "Walked around the office. Saw the sun.",
                "Got coffee. Stared at nothing for a bit.",
                "Took a real lunch break. Revolutionary.",
                "Stepped away from the screen. Remembered you have a body.",
                "Chatted with someone about non-work stuff.",
                "Looked out the window. Clouds are doing cloud things."
            ];
            addEvent(msgs[Math.floor(Math.random() * msgs.length)], 'neutral');
        },
        available: () => gameState.resources.codebase > 0
    },

    ship: {
        id: 'ship',
        name: 'ship release',
        cost: { energy: 40 },
        execute: () => {
            if (gameState.resources.codebase < 20) {
                addEvent("Not enough to ship yet.", 'neutral');
                return;
            }

            const isFirstShip = !gameState.narrative.flags.hasShipped;
            gameState.narrative.flags.hasShipped = true;
            const quality = gameState.resources.codebase;
            const debtPenalty = gameState.resources.techDebt * 3;
            const effectiveQuality = Math.max(0, quality - debtPenalty);

            if (gameState.resources.techDebt > 10) {
                addEvent("Shipped. Users found bugs immediately.", 'warning');
                gameState.resources.trust = Math.max(0, gameState.resources.trust - 10);
            } else if (effectiveQuality >= 50) {
                addEvent("Shipped. Users happy. Slack is calm.", 'success');
                gameState.resources.trust = Math.min(100, gameState.resources.trust + 5);
                gameState.narrative.flags.goodShip = true;
            } else {
                addEvent("Shipped. Mixed reception.", 'neutral');
            }

            // First ship unlocks vibe coding (autoclicker)
            if (isFirstShip) {
                gameState.settings.vibeMode = true;
                gameState.resources.apiCredits = 100;
                addEvent("Vibe coding unlocked. 100 free API credits.", 'success');
            }

            gameState.narrative.flags.shipCount = (gameState.narrative.flags.shipCount || 0) + 1;
            checkNarrativeTriggers();
        },
        available: () => gameState.resources.codebase >= 20
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

    for (const [resource, cost] of Object.entries(action.cost || {})) {
        gameState.resources[resource] -= cost;
    }

    action.execute();
    updateDisplay();
}

window.executeAction = executeAction;
