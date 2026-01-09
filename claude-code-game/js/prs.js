/**
 * PR System - Claude Code pull requests
 */

import { gameState } from './state.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';
import { getTask } from './tech-tree.js';

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

export function generatePR(quality, taskId = null, taskName = null) {
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
    const isPrototype = taskId === 'prototype';

    return {
        id: prIdCounter,
        taskId,
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

    // Get task info for message
    const task = pr.taskId ? getTask(pr.taskId) : null;

    // First prototype merge unlocks Claude Code assist
    if (pr.isPrototype && gameState.clickMultiplier === 1) {
        const multiplier = 1.1 + Math.random() * 0.2; // 1.1x to 1.3x
        gameState.clickMultiplier = Math.round(multiplier * 10) / 10;
        gameState.resources.apiCredits = 100;  // Starting credits
        gameState.narrative.flags.claudeCodeUnlocked = true;
        addEvent(`Merged "${pr.title}". Claude Code unlocked. Dev: ${gameState.clickMultiplier}x`, 'success');
    } else if (task?.message) {
        // Show task's unlock message
        addEvent(task.message, 'success');
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
