/**
 * Save/Load System and Dev Tools
 */

import { gameState } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';

export function saveGame() {
    try {
        localStorage.setItem('claudeCodeGame', JSON.stringify(gameState));
        addEvent('Game saved.', 'neutral');
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

            // Migration: ensure new resource fields exist with defaults
            if (gameState.resources.techDebt === undefined || gameState.resources.techDebt === null) {
                gameState.resources.techDebt = 0;
            }
            if (gameState.resources.reputation === undefined || gameState.resources.reputation === null) {
                gameState.resources.reputation = 0;
            }
            if (gameState.resources.githubStars === undefined || gameState.resources.githubStars === null) {
                gameState.resources.githubStars = 0;
            }
            // Migration for trending tech
            if (gameState.trendingTech === undefined) {
                gameState.trendingTech = null;
            }
            if (gameState.projectTech === undefined) {
                gameState.projectTech = null;
            }
            // Migration for competitor
            if (gameState.competitor === undefined) {
                gameState.competitor = null;
            }
            // Migration for real-time system
            if (gameState.narrative.ticksPlayed === undefined) {
                gameState.narrative.ticksPlayed = 0;
            }
            if (gameState.narrative.rentPerTick === undefined) {
                gameState.narrative.rentPerTick = 0.5;
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

// Dev tools for testing
export const devTools = {
    addMoney: (amount = 1000) => {
        gameState.resources.money += amount;
        addEvent(`[DEV] Added $${amount}`, 'neutral');
        updateDisplay();
    },

    addCodebase: (amount = 50) => {
        gameState.resources.codebase += amount;
        addEvent(`[DEV] Added ${amount} codebase`, 'neutral');
        updateDisplay();
    },

    addStars: (amount = 50) => {
        gameState.resources.githubStars += amount;
        addEvent(`[DEV] Added ${amount} stars`, 'neutral');
        updateDisplay();
    },

    setFlag: (flag, value = true) => {
        gameState.narrative.flags[flag] = value;
        addEvent(`[DEV] Set flag ${flag} = ${value}`, 'neutral');
        updateDisplay();
    },

    setBranch: (branch) => {
        gameState.narrative.branch = branch;
        addEvent(`[DEV] Set branch to ${branch}`, 'neutral');
        updateDisplay();
    },

    showState: () => {
        console.log('=== GAME STATE ===');
        console.log('Resources:', gameState.resources);
        console.log('Path Resources:', gameState.pathResources);
        console.log('Narrative:', gameState.narrative);
        console.log('Upgrades:', gameState.upgrades);
        console.log('Passive Effects:', gameState.passiveEffects);
    },

    triggerUpgrade: (upgradeId) => {
        // Force an upgrade to appear regardless of conditions
        import('./upgrades.js').then(({ upgradeDefinitions }) => {
            const upgrade = upgradeDefinitions[upgradeId];
            if (upgrade) {
                const originalCondition = upgrade.condition;
                upgrade.condition = () => true;
                updateDisplay();
                upgrade.condition = originalCondition;
            }
        });
    },

    unlockAllPaths: () => {
        // For testing different narrative branches
        gameState.pathResources.userTrust = 50;
        gameState.pathResources.craftMastery = 10;
        gameState.pathResources.runway = 12;
        gameState.pathResources.teamMorale = 70;
        gameState.pathResources.marketPosition = 30;
        gameState.pathResources.aiCapability = 20;
        gameState.pathResources.oversight = 80;
        gameState.pathResources.dependency = 10;
        updateDisplay();
    }
};

// Make dev tools globally available
window.dev = devTools;
