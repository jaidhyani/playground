/**
 * PR System - Claude Code pull requests
 */

import { gameState } from './state.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';

let prIdCounter = 0;

const prTitles = {
    general: [
        "Fix edge case in parser",
        "Update dependencies",
        "Improve error messages",
        "Add logging",
        "Refactor config handling",
        "Fix race condition",
        "Clean up dead code",
        "Add retry logic",
        "Fix memory leak",
        "Improve startup time",
    ],
    mcp: [
        "Add filesystem MCP server",
        "Fix tool parameter validation",
        "Add MCP debugging mode",
        "Improve tool discovery",
        "Fix MCP connection pooling",
        "Add MCP server templates",
        "Fix tool timeout handling",
    ],
    agents: [
        "Improve agent planning",
        "Fix agent loop detection",
        "Add agent memory",
        "Improve task decomposition",
        "Fix agent context overflow",
        "Add agent checkpointing",
        "Improve agent error recovery",
    ],
    evals: [
        "Add new benchmark suite",
        "Fix eval flakiness",
        "Improve eval reproducibility",
        "Add regression tests",
        "Fix eval data leakage",
        "Add performance metrics",
        "Improve eval reporting",
    ],
    infra: [
        "Fix deploy script",
        "Add health checks",
        "Improve monitoring",
        "Fix scaling issues",
        "Add alerting",
        "Fix rate limiting",
        "Improve caching",
    ]
};

export function generatePR(quality, taskName = null) {
    prIdCounter++;

    // Use task name as title, or pick from general pool
    let title;
    if (taskName) {
        title = taskName;
    } else {
        title = prTitles.general[Math.floor(Math.random() * prTitles.general.length)];
    }

    const hasBug = quality < 0.4 && Math.random() < 0.5;
    const codebaseGain = Math.floor(3 + quality * 7);
    const techDebtGain = quality < 0.5 ? Math.floor((0.5 - quality) * 6) : 0;
    const isPrototype = title === 'Claude Code Prototype';

    return {
        id: prIdCounter,
        title,
        quality,
        hasBug,
        codebaseGain,
        techDebtGain,
        isPrototype
    };
}

export function mergePR(prId) {
    const prIndex = gameState.prQueue.findIndex(pr => pr.id === prId);
    if (prIndex === -1) return;

    const pr = gameState.prQueue[prIndex];
    gameState.prQueue.splice(prIndex, 1);

    gameState.resources.codebase += pr.codebaseGain;
    gameState.resources.techDebt += pr.techDebtGain;

    // First prototype merge gives random click multiplier and unlocks new tasks
    if (pr.isPrototype && gameState.clickMultiplier === 1) {
        const multiplier = 1.5 + Math.random() * 1.5; // 1.5x to 3x
        gameState.clickMultiplier = Math.round(multiplier * 10) / 10;
        addEvent(`Merged "${pr.title}". Capability boost: ${gameState.clickMultiplier}x`, 'success');

        // Add initial task pool after prototype
        gameState.tasks.push(
            { id: 'mcp-filesystem', name: 'Filesystem MCP server', progress: 0, clicksNeeded: 40, oneOff: true },
            { id: 'error-messages', name: 'Improve error messages', progress: 0, clicksNeeded: 30 },
            { id: 'tool-validation', name: 'Tool parameter validation', progress: 0, clicksNeeded: 35 }
        );
    } else if (pr.hasBug) {
        addEvent(`Merged "${pr.title}". Bug found. Proactive identification needed.`, 'warning');
        gameState.resources.trust = Math.max(0, gameState.resources.trust - 3);
    } else if (pr.quality > 0.7) {
        addEvent(`Merged "${pr.title}". Aligned with expectations.`, 'success');
    } else {
        addEvent(`Merged "${pr.title}".`, 'neutral');
    }

    checkNarrativeTriggers();
    updateDisplay();
}

window.mergePR = mergePR;
