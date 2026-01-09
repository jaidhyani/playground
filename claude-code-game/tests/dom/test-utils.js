/**
 * DOM Testing Utilities
 *
 * Provides reusable setup/teardown for DOM tests.
 */

import { gameState } from '../../js/state.js';

/**
 * Standard HTML structure matching index.html
 */
const BASE_HTML = `
    <div id="game-container">
        <header id="game-header">
            <h1>Universal Paperclaudes</h1>
            <div id="resources">
                <span class="resource" data-resource="date"><span id="game-date">Mon Jan 6</span></span>
                <span class="resource" data-resource="codebase">codebase:<span id="codebase">0</span></span>
                <span class="resource" data-resource="techDebt" id="tech-debt-display" style="display:none">debt:<span id="techDebt">0</span></span>
                <span class="resource" data-resource="trust">trust:<span id="trust">50</span></span>
                <span class="resource" data-resource="multiplier" id="multiplier-display" style="display:none">dev:<span id="multiplier">1.0x</span></span>
                <span class="resource" data-resource="apiCredits" id="api-credits-display" style="display:none">credits:<span id="apiCredits">0</span></span>
                <span class="resource" data-resource="money" id="money-display" style="display:none">$<span id="money">0</span></span>
            </div>
        </header>

        <div id="main-content">
            <div id="gameplay">
                <div id="log"></div>
                <div id="buttons"></div>
            </div>
            <div id="pr-panel" class="panel hidden">
                <div class="panel-header">Pull Request</div>
                <div id="pr-title" class="pr-title"></div>
                <div id="pr-details" class="pr-details"></div>
                <div class="panel-actions">
                    <button id="pr-accept" class="btn action">merge</button>
                    <button id="pr-close" class="btn decline">close</button>
                </div>
            </div>
        </div>

        <footer id="game-footer">
            <button id="save-btn">save</button>
            <button id="load-btn">load</button>
            <button id="reset-btn">reset</button>
        </footer>
    </div>

    <div id="game-over-modal" class="modal">
        <div class="modal-content">
            <h2 class="game-over-title">Game Over</h2>
            <p class="game-over-message"></p>
            <div class="game-over-stats"></div>
            <button id="restart-btn">restart</button>
        </div>
    </div>
`;

/**
 * Set up full DOM structure for testing
 */
export function setupDOM() {
    document.body.innerHTML = BASE_HTML;
}

/**
 * Clean up DOM after tests
 */
export function teardownDOM() {
    document.body.innerHTML = '';
}

/**
 * Reset game state to initial values
 */
export function resetGameState() {
    // Resources
    gameState.resources.codebase = 0;
    gameState.resources.techDebt = 0;
    gameState.resources.trust = 50;
    gameState.resources.apiCredits = 0;
    gameState.resources.money = 0;

    // Game date
    gameState.gameDate = new Date(2025, 0, 6);

    // Tasks and progress
    gameState.tasks = [];
    gameState.completedTasks = [];
    gameState.prQueue = [];

    // Multiplier
    gameState.clickMultiplier = 1;

    // Narrative
    gameState.narrative.events = [];
    gameState.narrative.flags = {};
    gameState.narrative.ticksPlayed = 0;

    // Upgrades
    gameState.upgrades = [];
    gameState.declinedUpgrades = [];
    gameState.passiveEffects = [];

    // Settings
    gameState.settings.autoMergePRs = false;
    gameState.settings.vibeMode = false;
    gameState.settings.claudeCodeAssist = false;
}

/**
 * Helper to get element and assert it exists
 */
export function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Element #${id} not found in DOM`);
    }
    return el;
}

/**
 * Helper to check if element is visible (display !== 'none')
 */
export function isVisible(id) {
    return getElement(id).style.display !== 'none';
}

/**
 * Helper to get text content of element
 */
export function getText(id) {
    return getElement(id).textContent;
}

/**
 * Helper to find button by text content
 */
export function findButton(text) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        if (btn.textContent.includes(text)) {
            return btn;
        }
    }
    return null;
}

/**
 * Helper to simulate click on element
 */
export function click(element) {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
