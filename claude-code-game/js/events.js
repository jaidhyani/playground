/**
 * Events - Things that happen at Anthropic
 */

import { gameState } from './state.js';
import { updateDisplay, renderLog, showGameOver } from './render.js';

export function addEvent(message, type = 'neutral') {
    gameState.narrative.events.unshift({
        message,
        type,
        tick: gameState.narrative.ticksPlayed,
        date: gameState.gameDate ? new Date(gameState.gameDate) : null
    });

    if (gameState.narrative.events.length > 30) {
        gameState.narrative.events.pop();
    }

    renderLog();
}

export function checkNarrativeTriggers() {
    const { codebase, techDebt, trust } = gameState.resources;
    const flags = gameState.narrative.flags;

    // Tech debt warning
    if (techDebt >= 15 && !flags.debtWarning) {
        flags.debtWarning = true;
        addEvent("Technical debt accumulating. Scalable oversight getting harder.", 'warning');
    }

    // Trust milestones
    if (trust >= 75 && !flags.highTrust) {
        flags.highTrust = true;
        addEvent("Earned autonomy. Show, don't tell.", 'success');
    }

    if (trust <= 25 && !flags.lowTrust) {
        flags.lowTrust = true;
        addEvent("More oversight. Planning is indispensable.", 'warning');
    }

    // Codebase milestones
    if (codebase >= 50 && !flags.codebase50) {
        flags.codebase50 = true;
        addEvent("Claude Code growing. Responsible scaling in action.", 'success');
    }

    if (codebase >= 100 && !flags.codebase100) {
        flags.codebase100 = true;
        addEvent("Major milestone. The frontier moves forward.", 'success');
    }

    // Game over conditions
    if (trust <= 0) {
        triggerGameOver('fired');
    }
}

export function triggerGameOver(reason) {
    gameState.narrative.flags.gameOverReason = reason;

    if (reason === 'fired') {
        gameState.narrative.flags.ending = 'fired';
        addEvent("Trust gone. Exit interview scheduled.", 'negative');
    }

    setTimeout(() => showGameOver(), 1500);
}

// Random flavor events removed - were more distracting than valuable
