/**
 * PR System - Generation and management of pull requests
 */

import { gameState } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

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

export function generatePR(quality) {
    const titlePool = quality > 0.7 ? prTitles.good :
                      quality > 0.3 ? prTitles.mediocre : prTitles.bad;

    // Test suite reduces bug probability
    const testBonus = gameState.narrative.flags.hasTests === 'comprehensive' ? 0.25 :
                      gameState.narrative.flags.hasTests === 'basic' ? 0.1 : 0;
    const hasBug = Math.random() > (0.5 + quality * 0.3 + testBonus);
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

export function mergePR(prId) {
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

export function rejectPR(prId) {
    const prIndex = gameState.prQueue.findIndex(pr => pr.id === prId);
    if (prIndex === -1) return;

    const pr = gameState.prQueue[prIndex];
    gameState.prQueue.splice(prIndex, 1);

    addEvent(`Rejected: "${pr.title}"`, 'neutral');
    updateDisplay();
}

// Make functions globally available for onclick handlers
window.mergePR = mergePR;
window.rejectPR = rejectPR;
