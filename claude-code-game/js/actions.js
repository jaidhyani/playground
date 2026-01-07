/**
 * Actions - What you can do at Anthropic
 */

import { gameState, hasUpgrade } from './state.js';
import { generatePR, mergePR } from './prs.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';

export const actions = {
    // Tasks are now clickable progress bars - see main.js clickTask()

    ship: {
        id: 'ship',
        name: 'ship release',
        cost: {},
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
                addEvent("Shipped. Identified harms post-deployment.", 'warning');
                gameState.resources.trust = Math.max(0, gameState.resources.trust - 10);
            } else if (effectiveQuality >= 50) {
                addEvent("Shipped. Safe and beneficial.", 'success');
                gameState.resources.trust = Math.min(100, gameState.resources.trust + 5);
                gameState.narrative.flags.goodShip = true;
            } else {
                addEvent("Shipped. Measuring impact.", 'neutral');
            }

            // First ship unlocks vibe coding (autoclicker)
            if (isFirstShip) {
                gameState.settings.vibeMode = true;
                gameState.resources.apiCredits = 100;
                addEvent("Claude can write code autonomously now. 100 API credits.", 'success');
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
