/**
 * Upgrades/Decisions - Key choices that shape your path
 */

import { gameState, hasUpgrade } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

export const upgradeDefinitions = {
    // Focus removed - task selection handles this now

    // Buy API credits when running low (repeatable)
    buyCredits: {
        id: 'buyCredits',
        name: 'low on API credits',
        description: '',
        cost: {},
        repeatable: true,
        decisions: [
            {
                id: 'buy100',
                label: 'buy 100 credits ($50)',
                effect: () => {
                    if (gameState.resources.money >= 50) {
                        gameState.resources.money -= 50;
                        gameState.resources.apiCredits += 100;
                        addEvent("Bought 100 API credits.", 'neutral');
                    }
                }
            },
            {
                id: 'buy500',
                label: 'buy 500 credits ($200)',
                effect: () => {
                    if (gameState.resources.money >= 200) {
                        gameState.resources.money -= 200;
                        gameState.resources.apiCredits += 500;
                        addEvent("Bought 500 API credits. Bulk discount.", 'success');
                    }
                }
            }
        ],
        condition: () => gameState.settings.vibeMode &&
            gameState.resources.apiCredits < 20 &&
            gameState.resources.money >= 50
    },

    // Auto-merge decision
    autoMerge: {
        id: 'autoMerge',
        name: 'pr queue building up',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'auto',
                label: 'auto-merge everything',
                effect: () => {
                    gameState.settings.autoMergePRs = true;
                    addEvent("Auto-merge on. Scaling faster.", 'neutral');
                }
            },
            {
                id: 'manual',
                label: 'keep reviewing manually',
                effect: () => {
                    addEvent("Manual review. Scalable oversight.", 'success');
                }
            }
        ],
        condition: () => gameState.prQueue.length >= 3 && !hasUpgrade('autoMerge')
    },

    // First major technical decision
    architectureChoice: {
        id: 'architectureChoice',
        name: 'architecture decision',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'fast',
                label: 'ship fast, fix later',
                effect: () => {
                    gameState.resources.codebase += 15;
                    gameState.resources.techDebt += 8;
                    addEvent("Shipped. Plans are useless, planning is indispensable.", 'warning');
                }
            },
            {
                id: 'careful',
                label: 'do it right the first time',
                effect: () => {
                    gameState.resources.codebase += 8;
                    gameState.resources.trust += 5;
                    addEvent("Process-oriented. Aligned implementation.", 'success');
                }
            }
        ],
        condition: () => gameState.resources.codebase >= 15 && !hasUpgrade('architectureChoice')
    },

    // Trust unlock - more autonomy
    autonomy: {
        id: 'autonomy',
        name: 'earned some trust',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'take',
                label: 'take on bigger scope',
                effect: () => {
                    gameState.resources.trust += 10;
                    addEvent("Frontier work. The stakes are high.", 'success');
                }
            }
        ],
        condition: () =>
            gameState.narrative.flags.shipCount >= 2 &&
            gameState.resources.trust >= 60 &&
            !hasUpgrade('autonomy')
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

    // Deduct costs (if not declining)
    const isDecline = ['skip', 'manual'].includes(decisionId);
    if (!isDecline) {
        for (const [resource, cost] of Object.entries(upgrade.cost || {})) {
            gameState.resources[resource] -= cost;
        }
    }

    decision.effect();

    // Don't track repeatable upgrades
    if (!upgrade.repeatable) {
        gameState.upgrades.push(upgradeId);

        if (isDecline) {
            gameState.declinedUpgrades.push(upgradeId);
        }
    }

    updateDisplay();
}

window.executeUpgradeDecision = executeUpgradeDecision;
