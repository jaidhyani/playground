/**
 * Rendering - Flat button-based UI
 */

import { gameState, hasUpgrade } from './state.js';
import { actions, canAffordAction } from './actions.js';
import { upgradeDefinitions, canAffordUpgrade } from './upgrades.js';

export function updateDisplay() {
    renderResources();
    renderLog();
    renderButtons();
}

export function renderResources() {
    // Energy
    const energyEl = document.getElementById('energy');
    if (energyEl) energyEl.textContent = Math.floor(gameState.resources.energy);

    // Codebase
    const codebaseEl = document.getElementById('codebase');
    if (codebaseEl) codebaseEl.textContent = Math.floor(gameState.resources.codebase);

    // Tech Debt (conditional)
    const techDebtEl = document.getElementById('techDebt');
    const techDebtDisplay = document.getElementById('tech-debt-display');
    if (techDebtEl) techDebtEl.textContent = Math.floor(gameState.resources.techDebt);
    if (techDebtDisplay) {
        techDebtDisplay.style.display = gameState.resources.techDebt > 0 ? 'inline' : 'none';
    }

    // Trust
    const trustEl = document.getElementById('trust');
    if (trustEl) trustEl.textContent = Math.floor(gameState.resources.trust);

    // API Credits (shown after vibe coding unlocks)
    const apiCreditsEl = document.getElementById('apiCredits');
    const apiCreditsDisplay = document.getElementById('api-credits-display');
    if (apiCreditsEl) apiCreditsEl.textContent = Math.floor(gameState.resources.apiCredits);
    if (apiCreditsDisplay) {
        apiCreditsDisplay.style.display = gameState.settings.vibeMode ? 'inline' : 'none';
    }

    // Money (shown when low on credits or payday happens)
    const moneyEl = document.getElementById('money');
    const moneyDisplay = document.getElementById('money-display');
    if (moneyEl) moneyEl.textContent = Math.floor(gameState.resources.money);
    if (moneyDisplay) {
        const showMoney = gameState.narrative.flags.moneyRevealed ||
            (gameState.settings.vibeMode && gameState.resources.apiCredits < 50);
        moneyDisplay.style.display = showMoney ? 'inline' : 'none';
    }
}

export function renderLog() {
    const container = document.getElementById('log');
    if (!container) return;

    const html = gameState.narrative.events.slice(0, 8).map(e => {
        const typeClass = e.type === 'success' ? 'good' :
                         e.type === 'negative' ? 'bad' :
                         e.type === 'warning' ? 'warning' : '';
        return `<div class="log-entry ${typeClass}">${e.message}</div>`;
    }).join('');

    container.innerHTML = html;
}

export function renderButtons() {
    const container = document.getElementById('buttons');
    if (!container) return;

    let html = '';

    // Actions
    for (const action of Object.values(actions)) {
        if (!action.available()) continue;
        const canAfford = canAffordAction(action);
        const costText = action.cost?.energy ? ` (${action.cost.energy} energy)` : '';

        // Code action gets a progress bar
        if (action.id === 'code') {
            const progress = Math.floor(gameState.codingProgress);
            html += `<button class="btn action progress-btn" ${canAfford ? '' : 'disabled'} onclick="executeAction('${action.id}')">
                <span class="progress-fill" style="width:${progress}%"></span>
                <span class="progress-text">${action.name} ${progress}%${costText}</span>
            </button>`;
        } else {
            html += `<button class="btn action" ${canAfford ? '' : 'disabled'} onclick="executeAction('${action.id}')">${action.name}${costText}</button>`;
        }
    }

    // PRs as merge buttons
    for (const pr of gameState.prQueue) {
        const isRisky = pr.quality < 0.4;
        const label = isRisky ? `merge "${pr.title}" ⚠` : `merge "${pr.title}"`;
        html += `<button class="btn pr ${isRisky ? 'risky' : ''}" onclick="mergePR(${pr.id})">${label}</button>`;
    }

    // Upgrades/Decisions
    for (const upgrade of Object.values(upgradeDefinitions)) {
        if (!upgrade.condition()) continue;
        const canAfford = canAffordUpgrade(upgrade);

        // Show upgrade name as context
        if (upgrade.decisions.length > 1) {
            html += `<span class="upgrade-label">${upgrade.name}:</span> `;
        }

        for (const decision of upgrade.decisions) {
            const isDecline = ['skip', 'manual'].includes(decision.id);
            const disabled = !canAfford && !isDecline;
            const btnClass = isDecline ? 'decline' : 'upgrade';

            html += `<button class="btn ${btnClass}" ${disabled ? 'disabled' : ''} onclick="executeUpgradeDecision('${upgrade.id}', '${decision.id}')">${decision.label}</button>`;
        }
    }

    container.innerHTML = html || '<span style="color:#444">nothing to do</span>';
}

export function renderEvents() {
    renderLog();
}

export function showGameOver() {
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.game-over-title');
    const messageEl = modal.querySelector('.game-over-message');
    const statsEl = modal.querySelector('.game-over-stats');

    const ending = gameState.narrative.flags.ending;

    if (titleEl) {
        if (ending === 'burnout') {
            titleEl.textContent = 'burnout';
            titleEl.style.color = '#f80';
        } else if (ending === 'fired') {
            titleEl.textContent = 'let go';
            titleEl.style.color = '#f00';
        } else {
            titleEl.textContent = 'the end';
            titleEl.style.color = '#0f0';
        }
    }

    if (messageEl) {
        if (ending === 'burnout') {
            messageEl.textContent = "Pushed too hard. Rest up.";
        } else if (ending === 'fired') {
            messageEl.textContent = "Trust hit zero. Time to move on.";
        } else {
            messageEl.textContent = "Game over.";
        }
    }

    if (statsEl) {
        statsEl.innerHTML = `
            codebase: ${Math.floor(gameState.resources.codebase)}<br>
            tech debt: ${Math.floor(gameState.resources.techDebt)}<br>
            focus: ${gameState.focus || 'none'}
        `;
    }

    modal.style.display = 'flex';
}
