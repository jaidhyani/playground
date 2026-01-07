/**
 * Events - Things that happen at Anthropic
 */

import { gameState } from './state.js';
import { updateDisplay, renderLog, showGameOver } from './render.js';

export function addEvent(message, type = 'neutral') {
    gameState.narrative.events.unshift({
        message,
        type,
        tick: gameState.narrative.ticksPlayed
    });

    if (gameState.narrative.events.length > 20) {
        gameState.narrative.events.pop();
    }

    renderLog();
}

export function checkNarrativeTriggers() {
    const { codebase, techDebt, trust, energy } = gameState.resources;
    const flags = gameState.narrative.flags;

    // Burnout
    if (energy <= 0 && !flags.burnedOut) {
        flags.burnedOut = true;
        addEvent("Burnout. Taking a few days.", 'negative');
        gameState.resources.energy = 20;
        gameState.resources.trust = Math.max(0, trust - 10);
    }

    // Reset burnout flag when recovered
    if (energy > 50 && flags.burnedOut) {
        flags.burnedOut = false;
    }

    // Tech debt warning
    if (techDebt >= 15 && !flags.debtWarning) {
        flags.debtWarning = true;
        addEvent("Tech debt accumulating. Velocity slowing.", 'warning');
    }

    // Trust milestones
    if (trust >= 75 && !flags.highTrust) {
        flags.highTrust = true;
        addEvent("Leadership gives you more autonomy.", 'success');
    }

    if (trust <= 25 && !flags.lowTrust) {
        flags.lowTrust = true;
        addEvent("More oversight. More check-ins.", 'warning');
    }

    // Codebase milestones
    if (codebase >= 50 && !flags.codebase50) {
        flags.codebase50 = true;
        addEvent("Claude Code growing. Users noticing.", 'success');
    }

    if (codebase >= 100 && !flags.codebase100) {
        flags.codebase100 = true;
        addEvent("Major milestone. Claude Code is substantial now.", 'success');
    }

    // Game over conditions
    if (trust <= 0) {
        triggerGameOver('fired');
    }
}

export function triggerGameOver(reason) {
    gameState.narrative.flags.gameOverReason = reason;

    if (reason === 'burnout') {
        gameState.narrative.flags.ending = 'burnout';
        addEvent("Complete burnout. Medical leave.", 'negative');
    } else if (reason === 'fired') {
        gameState.narrative.flags.ending = 'fired';
        addEvent("Trust gone. Exit interview scheduled.", 'negative');
    }

    setTimeout(() => showGameOver(), 1500);
}

// Random flavor events removed - were more distracting than valuable
