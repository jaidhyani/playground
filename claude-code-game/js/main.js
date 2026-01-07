/**
 * Universal Paperclaudes - Main Entry Point
 *
 * You're an engineer at Anthropic working on Claude Code.
 */

import { gameState } from './state.js';
import { generatePR, mergePR } from './prs.js';
import { addEvent, checkNarrativeTriggers } from './events.js';
import { updateDisplay } from './render.js';
import { saveGame, loadGame, resetGame } from './save.js';
import { getStartingTasks, getAvailableTasks, getTask } from './tech-tree.js';

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

    // Advance date every 3 ticks (3 seconds = 1 day)
    if (gameState.narrative.ticksPlayed % 3 === 0) {
        const prevDate = new Date(gameState.gameDate);
        gameState.gameDate = new Date(gameState.gameDate.getTime() + 24 * 60 * 60 * 1000);

        // Payday on every other Friday (weeks 2, 4, 6, etc from start)
        const dayOfWeek = gameState.gameDate.getDay();
        const daysSinceStart = Math.floor((gameState.gameDate - new Date(2025, 0, 6)) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.floor(daysSinceStart / 7);
        const isPayWeek = weekNumber % 2 === 1;

        if (dayOfWeek === 5 && isPayWeek && prevDate.getDay() !== 5) {
            gameState.resources.money += 500;
            gameState.narrative.flags.moneyRevealed = true;
            addEvent("Payday. +$500", 'success');
        }
    }

    // Vibe coding autoclicker - Claude writes code automatically (costs API credits)
    if (gameState.settings.vibeMode && gameState.resources.apiCredits >= 1 && gameState.tasks.length > 0) {
        gameState.resources.apiCredits -= 1;

        // Work on first available task (vibe coding is slower than manual)
        const task = gameState.tasks[0];
        task.progress += gameState.clickMultiplier * 0.5;

        if (task.progress >= task.devPoints) {
            completeTask(task);
        }
    }

    // Check triggers
    checkNarrativeTriggers();

    updateDisplay();
}

function completeTask(task) {
    const quality = 0.5 + Math.random() * 0.3;
    const pr = generatePR(quality, task.id, task.name);
    gameState.prQueue.push(pr);
    addEvent(`PR ready: "${pr.title}"`, 'neutral');

    // Track completion for DAG progression
    if (!gameState.completedTasks.includes(task.id)) {
        gameState.completedTasks.push(task.id);
    }

    // Refresh available tasks based on DAG
    refreshAvailableTasks();

    if (gameState.settings.autoMergePRs) {
        mergePR(pr.id);
    }
}

function refreshAvailableTasks() {
    const available = getAvailableTasks(gameState.completedTasks);

    // Keep progress for tasks still in progress
    const progressMap = {};
    for (const task of gameState.tasks) {
        if (task.progress > 0) {
            progressMap[task.id] = task.progress;
        }
    }

    // Update tasks list
    gameState.tasks = available.map(task => ({
        ...task,
        progress: progressMap[task.id] || 0
    }));
}

function clickTask(taskId) {
    const task = gameState.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Each click adds multiplier points toward the task's devPoints requirement
    task.progress += gameState.clickMultiplier;

    if (task.progress >= task.devPoints) {
        completeTask(task);
    }

    updateDisplay();
}

window.clickTask = clickTask;

let selectedPR = null;

function openPR(prId) {
    const pr = gameState.prQueue.find(p => p.id === prId);
    if (!pr) return;

    selectedPR = pr;
    const panel = document.getElementById('pr-panel');
    const titleEl = document.getElementById('pr-title');
    const detailsEl = document.getElementById('pr-details');

    titleEl.textContent = pr.title;

    let details = `+${pr.codebaseGain} codebase`;
    if (pr.techDebtGain > 0) details += `, +${pr.techDebtGain} debt`;
    if (pr.quality < 0.4) details += '\n⚠ May have bugs';
    detailsEl.textContent = details;

    panel.classList.remove('hidden');
}

function closePR() {
    selectedPR = null;
    document.getElementById('pr-panel').classList.add('hidden');
}

function acceptPR() {
    if (selectedPR) {
        mergePR(selectedPR.id);
        closePR();
    }
}

window.openPR = openPR;

function init() {
    if (!loadGame()) {
        // New game - initialize with starting tasks from DAG
        const startingTasks = getStartingTasks();
        for (const task of startingTasks) {
            gameState.tasks.push({ ...task, progress: 0 });
        }
        // Anthropic's core view
        addEvent('"The impact of AI might be comparable to the industrial and scientific revolutions, but we aren\'t confident it will go well." <a href="https://www.anthropic.com/news/core-views-on-ai-safety" target="_blank" class="external-link" title="anthropic.com">↗</a>', 'neutral');
    } else {
        // Loaded game - refresh available tasks based on completed
        refreshAvailableTasks();
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
    document.getElementById('pr-accept')?.addEventListener('click', acceptPR);
    document.getElementById('pr-close')?.addEventListener('click', closePR);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key.toLowerCase()) {
            case ' ':
            case 'c':
                // Click first task
                if (gameState.tasks.length > 0) {
                    e.preventDefault();
                    clickTask(gameState.tasks[0].id);
                }
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
    console.log('Keys: Space/C-click task, S-ship, M-merge');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
