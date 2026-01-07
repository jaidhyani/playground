/**
 * Upgrades/Decisions - Key choices that shape your path
 */

import { gameState, hasUpgrade } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

export const upgradeDefinitions = {
    // First decision: what are you working on?
    focus: {
        id: 'focus',
        name: 'pick your focus',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'mcp',
                label: 'MCP servers',
                effect: () => {
                    gameState.focus = 'mcp';
                    addEvent("MCP it is. Tool-use is where it's at.", 'neutral');
                }
            },
            {
                id: 'agents',
                label: 'agentic workflows',
                effect: () => {
                    gameState.focus = 'agents';
                    addEvent("Agents. Let Claude do the work.", 'neutral');
                }
            },
            {
                id: 'evals',
                label: 'evals & benchmarks',
                effect: () => {
                    gameState.focus = 'evals';
                    addEvent("Evals. If you can't measure it...", 'neutral');
                }
            },
            {
                id: 'infra',
                label: 'infrastructure',
                effect: () => {
                    gameState.focus = 'infra';
                    addEvent("Infra. Someone has to keep the lights on.", 'neutral');
                }
            }
        ],
        condition: () => gameState.resources.codebase >= 5 && !gameState.focus && !hasUpgrade('focus')
    },

    // Unlock vibe coding
    vibeMode: {
        id: 'vibeMode',
        name: 'vibe coding',
        description: '',
        cost: {},
        decisions: [
            {
                id: 'enable',
                label: 'let Claude write the code',
                effect: () => {
                    gameState.settings.vibeMode = true;
                    gameState.codingProgress = 0;
                    addEvent("Vibe mode on. You prompt, Claude codes.", 'success');
                }
            },
            {
                id: 'skip',
                label: 'keep writing it yourself',
                effect: () => {
                    addEvent("Old school. Respectable.", 'neutral');
                }
            }
        ],
        condition: () => {
            const clicks = gameState.narrative.flags.manualCodeClicks || 0;
            return clicks >= 3 && !hasUpgrade('vibeMode');
        }
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
                    addEvent("Auto-merge on. YOLO.", 'neutral');
                }
            },
            {
                id: 'manual',
                label: 'keep reviewing manually',
                effect: () => {
                    addEvent("Manual review. Slower but safer.", 'success');
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
        cost: { energy: 20 },
        decisions: [
            {
                id: 'fast',
                label: 'ship fast, fix later',
                effect: () => {
                    gameState.resources.codebase += 15;
                    gameState.resources.techDebt += 8;
                    addEvent("Shipped it. Tech debt accruing.", 'warning');
                }
            },
            {
                id: 'careful',
                label: 'do it right the first time',
                effect: () => {
                    gameState.resources.codebase += 8;
                    gameState.resources.trust += 5;
                    addEvent("Took the time. Clean implementation.", 'success');
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
                    addEvent("More responsibility. More rope.", 'success');
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
    gameState.upgrades.push(upgradeId);

    if (isDecline) {
        gameState.declinedUpgrades.push(upgradeId);
    }

    updateDisplay();
}

window.executeUpgradeDecision = executeUpgradeDecision;
