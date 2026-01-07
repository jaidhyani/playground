/**
 * Save/Load System
 */

import { gameState } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

export function saveGame() {
    try {
        localStorage.setItem('claudeCodeGame', JSON.stringify(gameState));
        addEvent('Saved.', 'neutral');
    } catch (e) {
        console.error('Failed to save:', e);
    }
}

export function loadGame() {
    try {
        const saved = localStorage.getItem('claudeCodeGame');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(gameState, parsed);
            gameState.lastTick = Date.now();

            // Migrations for old saves
            if (gameState.resources.trust === undefined) {
                gameState.resources.trust = 50;
            }
            if (gameState.resources.techDebt === undefined) {
                gameState.resources.techDebt = 0;
            }
            if (gameState.settings.vibeMode === undefined) {
                gameState.settings.vibeMode = false;
            }
            if (gameState.clickMultiplier === undefined) {
                gameState.clickMultiplier = 1;
            }
            if (gameState.tasks === undefined) {
                gameState.tasks = [];
            }
            if (gameState.completedTasks === undefined) {
                gameState.completedTasks = [];
            }
            // Convert old date strings back to Date objects
            if (gameState.gameDate && typeof gameState.gameDate === 'string') {
                gameState.gameDate = new Date(gameState.gameDate);
            }

            updateDisplay();
            return true;
        }
    } catch (e) {
        console.error('Failed to load:', e);
    }
    return false;
}

export function resetGame() {
    localStorage.removeItem('claudeCodeGame');
    location.reload();
}

// Dev tools
export const dev = {
    addCodebase: (n = 20) => {
        gameState.resources.codebase += n;
        updateDisplay();
    },
    addTrust: (n = 20) => {
        gameState.resources.trust = Math.min(100, gameState.resources.trust + n);
        updateDisplay();
    },
    addDebt: (n = 10) => {
        gameState.resources.techDebt += n;
        updateDisplay();
    },
    addCredits: (n = 100) => {
        gameState.resources.apiCredits += n;
        updateDisplay();
    },
    addMoney: (n = 500) => {
        gameState.resources.money += n;
        updateDisplay();
    },
    state: () => console.log(gameState)
};

window.dev = dev;
