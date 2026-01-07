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
    const resources = ['money', 'energy', 'codebase', 'techDebt', 'reputation', 'githubStars'];

    resources.forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        const val = key === 'codebase' ? gameState.resources[key].toFixed(0) : Math.floor(gameState.resources[key]);
        el.textContent = val;
    });

    // Show/hide conditional resources
    const techDebtDisplay = document.getElementById('tech-debt-display');
    if (techDebtDisplay) {
        techDebtDisplay.style.display = gameState.resources.techDebt > 0 ? 'inline' : 'none';
    }

    const reputationDisplay = document.getElementById('reputation-display');
    if (reputationDisplay) {
        reputationDisplay.style.display = gameState.resources.reputation > 0 ? 'inline' : 'none';
    }

    const starsDisplay = document.getElementById('stars-display');
    if (starsDisplay) {
        starsDisplay.style.display = gameState.resources.githubStars > 0 ? 'inline' : 'none';
    }
}

export function renderLog() {
    const container = document.getElementById('log');
    if (!container) return;

    const html = gameState.narrative.events.slice(0, 8).map(e => {
        const typeClass = e.type === 'success' || e.type === 'positive' ? 'good' :
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
        const costText = action.cost?.energy ? ` (${action.cost.energy})` : '';

        html += `<button class="btn action" ${canAfford ? '' : 'disabled'} onclick="executeAction('${action.id}')">${action.name}${costText}</button>`;
    }

    // PRs as merge buttons
    for (const pr of gameState.prQueue) {
        const isRisky = pr.quality < 0.4;
        const label = isRisky ? `merge "${pr.title}" ⚠` : `merge "${pr.title}"`;
        html += `<button class="btn pr ${isRisky ? 'risky' : ''}" onclick="mergePR(${pr.id})">${label}</button>`;
    }

    // Upgrades
    for (const upgrade of Object.values(upgradeDefinitions)) {
        if (!upgrade.condition()) continue;
        const canAfford = canAffordUpgrade(upgrade);

        for (const decision of upgrade.decisions) {
            const isDecline = ['skip', 'reject', 'noTracking'].includes(decision.id);
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
    const reason = gameState.narrative.flags.gameOverReason;

    if (titleEl) {
        if (ending === 'sustainable') {
            titleEl.textContent = 'sustainable';
            titleEl.style.color = '#0f0';
        } else if (ending === 'stardom') {
            titleEl.textContent = 'stardom';
            titleEl.style.color = '#ff0';
        } else if (ending === 'sold') {
            titleEl.textContent = 'acquired';
            titleEl.style.color = '#0af';
        } else {
            titleEl.textContent = 'bankrupt';
            titleEl.style.color = '#f00';
        }
    }

    if (messageEl) {
        if (ending === 'sustainable') {
            messageEl.textContent = "Revenue covers costs. You're free.";
        } else if (ending === 'stardom') {
            messageEl.textContent = "2000 stars. You made it.";
        } else if (ending === 'sold') {
            messageEl.textContent = "The check cleared.";
        } else {
            messageEl.textContent = "Out of money.";
        }
    }

    if (statsEl) {
        const weeklyIncome = gameState.passiveEffects.reduce((sum, e) => sum + (e.weeklyIncome || 0), 0);
        statsEl.innerHTML = `
            codebase: ${Math.floor(gameState.resources.codebase)}<br>
            stars: ${gameState.resources.githubStars}<br>
            revenue: $${weeklyIncome}/wk
        `;
    }

    modal.style.display = 'flex';
}
