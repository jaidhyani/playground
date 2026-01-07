/**
 * Universal Paperclaudes - Main Entry Point
 *
 * An incremental game about an indie developer navigating the rise of AI.
 * Choices branch the narrative - there are no "phases", only consequences.
 */

import { gameState } from './state.js';
import { addEvent } from './events.js';
import { updateDisplay } from './render.js';
import { saveGame, loadGame, resetGame } from './save.js';

// Game loop
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

    // Energy regenerates over time
    let energyRegen = 0.5;  // Base regen per tick
    for (const effect of gameState.passiveEffects) {
        if (effect.energyRegen) {
            energyRegen += effect.energyRegen * 0.1;
        }
    }
    gameState.resources.energy = Math.min(100, gameState.resources.energy + energyRegen);

    // Money drains for rent (continuous)
    gameState.resources.money -= gameState.narrative.rentPerTick;

    // Passive income from products/sponsors
    let tickIncome = 0;
    for (const effect of gameState.passiveEffects) {
        if (effect.weeklyIncome) {
            tickIncome += effect.weeklyIncome / 60;  // Spread weekly income across ~60 ticks
        }
        if (effect.monthlyCost) {
            gameState.resources.money -= effect.monthlyCost / 240;  // ~240 ticks per "month"
        }
    }
    gameState.resources.money += tickIncome;

    // Contractor codebase contribution
    const contractorEffect = gameState.passiveEffects.find(e => e.id === 'contractor');
    if (contractorEffect?.weeklyCodebase) {
        gameState.resources.codebase += contractorEffect.weeklyCodebase / 60;
    }

    // Passive star growth
    if (gameState.resources.githubStars > 10 && gameState.narrative.ticksPlayed % 30 === 0) {
        const starGrowth = Math.floor(gameState.resources.githubStars * 0.01);
        if (starGrowth > 0) {
            gameState.resources.githubStars += starGrowth;
        }
    }

    // Initialize trending tech if not set
    if (!gameState.trendingTech && gameState.resources.codebase > 0) {
        const techTrends = ['ai', 'web3', 'vr', 'mobile', 'devtools', 'saas', 'cli'];
        gameState.trendingTech = techTrends[Math.floor(Math.random() * techTrends.length)];
    }

    // Random events every ~60 ticks (1 minute)
    if (gameState.narrative.ticksPlayed % 60 === 0) {
        import('./events.js').then(({ generateRandomEvent, updateCompetitorTick }) => {
            generateRandomEvent();
            updateCompetitorTick();
        });
    }

    // Check for bankruptcy
    if (gameState.resources.money < 0) {
        import('./events.js').then(({ triggerGameOver }) => {
            triggerGameOver('broke');
        });
    }

    updateDisplay();
}

function init() {
    // Try to load saved game
    if (!loadGame()) {
        // New game - add welcome events
        addEvent("Don't run out of money. Rent drains continuously.", 'warning');
        addEvent("You're an indie developer with a laptop and some savings. Start coding.", 'neutral');
    }

    // Start game loop
    gameState.lastTick = Date.now();
    requestAnimationFrame(gameLoop);

    // Wire up button handlers
    document.getElementById('save-btn')?.addEventListener('click', saveGame);
    document.getElementById('load-btn')?.addEventListener('click', () => {
        if (loadGame()) {
            addEvent('Game loaded.', 'neutral');
        }
    });
    document.getElementById('reset-btn')?.addEventListener('click', resetGame);
    document.getElementById('restart-btn')?.addEventListener('click', resetGame);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key.toLowerCase()) {
            case 'c': // Code
                if (typeof executeAction === 'function') executeAction('code');
                break;
            case 'v': // Vibe Code
                if (typeof executeAction === 'function') executeAction('vibeCode');
                break;
            case 'f': // Freelance
                if (typeof executeAction === 'function') executeAction('freelance');
                break;
            case 'r': // Rest
                if (typeof executeAction === 'function') executeAction('rest');
                break;
            case 'n': // Network
                if (typeof executeAction === 'function') executeAction('network');
                break;
            case 'h': // Hacker News
                if (typeof executeAction === 'function') executeAction('postToHN');
                break;
            case 's': // Ship or Save (Ctrl+S)
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    saveGame();
                } else {
                    if (typeof executeAction === 'function') executeAction('ship');
                }
                break;
            case 'm': // Merge first PR
                if (gameState.prQueue.length > 0 && typeof mergePR === 'function') {
                    mergePR(gameState.prQueue[0].id);
                }
                break;
            case 'i': // Iterate
                if (typeof executeAction === 'function') executeAction('iterate');
                break;
            case 'o': // Open Source
                if (typeof executeAction === 'function') executeAction('openSource');
                break;
            case 'p': // Promote/Market
                if (typeof executeAction === 'function') executeAction('market');
                break;
            case 'u': // Release Update
                if (typeof executeAction === 'function') executeAction('releaseUpdate');
                break;
            case 't': // Customer Support
                if (typeof executeAction === 'function') executeAction('support');
                break;
            case 'd': // Deep Refactor
                if (typeof executeAction === 'function') executeAction('refactor');
                break;
        }
    });

    // Initial render
    updateDisplay();

    console.log('Universal Paperclaudes');
    console.log('Keyboard: C-Code, V-Vibe, F-Freelance, R-Rest');
    console.log('          S-Ship, M-Merge PR, Ctrl+S-Save');
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
