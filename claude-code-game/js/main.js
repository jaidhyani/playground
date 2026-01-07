/**
 * Universal Paperclaudes - Main Entry Point
 *
 * You're an engineer at Anthropic working on Claude Code.
 */

import { gameState } from './state.js';
import { addEvent, maybeRandomEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';
import { saveGame, loadGame, resetGame } from './save.js';

function gameLoop() {
    const now = Date.now();
    const delta = now - gameState.lastTick;

    if (delta >= gameState.tickRate) {
        gameState.lastTick = now;
        tick();
    }

    requestAnimationFrame(gameLoop);
}

function tick() {
    gameState.narrative.ticksPlayed++;

    // Energy regenerates slowly
    gameState.resources.energy = Math.min(100, gameState.resources.energy + 0.3);

    // Tech debt slows energy regen
    if (gameState.resources.techDebt > 10) {
        gameState.resources.energy = Math.min(100, gameState.resources.energy - 0.1);
    }

    // Random events
    maybeRandomEvent();

    // Check triggers
    checkNarrativeTriggers();

    updateDisplay();
}

function init() {
    if (!loadGame()) {
        // New game
        addEvent("First day on Claude Code. Time to ship.", 'neutral');
    }

    gameState.lastTick = Date.now();
    requestAnimationFrame(gameLoop);

    // Button handlers
    document.getElementById('save-btn')?.addEventListener('click', saveGame);
    document.getElementById('load-btn')?.addEventListener('click', () => {
        if (loadGame()) {
            addEvent('Loaded.', 'neutral');
        }
    });
    document.getElementById('reset-btn')?.addEventListener('click', resetGame);
    document.getElementById('restart-btn')?.addEventListener('click', resetGame);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key.toLowerCase()) {
            case 'c':
                if (typeof executeAction === 'function') executeAction('code');
                break;
            case 'v':
                if (typeof executeAction === 'function') executeAction('vibe');
                break;
            case 'r':
                if (typeof executeAction === 'function') executeAction('rest');
                break;
            case 'd':
                if (typeof executeAction === 'function') executeAction('refactor');
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    saveGame();
                } else {
                    if (typeof executeAction === 'function') executeAction('ship');
                }
                break;
            case 'm':
                if (gameState.prQueue.length > 0 && typeof mergePR === 'function') {
                    mergePR(gameState.prQueue[0].id);
                }
                break;
        }
    });

    updateDisplay();
    console.log('Universal Paperclaudes');
    console.log('Keys: C-code, V-vibe, R-rest, D-refactor, S-ship, M-merge');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
