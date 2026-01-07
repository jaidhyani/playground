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
    // Date
    const dateEl = document.getElementById('game-date');
    if (dateEl) {
        const d = gameState.gameDate;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateEl.textContent = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
    }

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

    // Click multiplier (shown after first PR merged)
    const multiplierEl = document.getElementById('multiplier');
    const multiplierDisplay = document.getElementById('multiplier-display');
    if (multiplierEl) multiplierEl.textContent = gameState.clickMultiplier.toFixed(1) + 'x';
    if (multiplierDisplay) {
        multiplierDisplay.style.display = gameState.clickMultiplier > 1 ? 'inline' : 'none';
    }

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

    // Tasks as clickable progress bars
    for (const task of gameState.tasks) {
        const progress = Math.floor(task.progress);
        html += `<button class="btn task progress-btn" onclick="clickTask('${task.id}')">
            <span class="progress-fill" style="width:${progress}%"></span>
            <span class="progress-text">${task.name} ${progress}%</span>
        </button>`;
    }

    // Actions (non-task)
    for (const action of Object.values(actions)) {
        if (!action.available()) continue;
        const canAfford = canAffordAction(action);
        html += `<button class="btn action" ${canAfford ? '' : 'disabled'} onclick="executeAction('${action.id}')">${action.name}</button>`;
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
        if (ending === 'fired') {
            titleEl.textContent = 'let go';
            titleEl.style.color = '#f00';
        } else {
            titleEl.textContent = 'the end';
            titleEl.style.color = '#0f0';
        }
    }

    if (messageEl) {
        if (ending === 'fired') {
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
