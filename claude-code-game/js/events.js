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

export function maybeRandomEvent() {
    if (Math.random() > 0.03) return;

    const events = [
        {
            condition: () => gameState.resources.codebase >= 10,
            messages: [
                { msg: "User filed a bug report. Vague but concerning.", type: 'neutral' },
                { msg: "Positive feedback in Discord.", type: 'success' },
                { msg: "Feature request that's already on the roadmap.", type: 'neutral' },
            ]
        },
        {
            condition: () => gameState.focus === 'mcp',
            messages: [
                { msg: "MCP request: tool-use for someone's smart fridge.", type: 'neutral' },
                { msg: "Community PR adds a useful MCP server.", type: 'success' },
                { msg: "MCP spec discussion getting heated on GitHub.", type: 'neutral' },
            ]
        },
        {
            condition: () => gameState.focus === 'evals',
            messages: [
                { msg: "Benchmark results in. Interpretable? Debatable.", type: 'neutral' },
                { msg: "METR published new numbers. Slack is active.", type: 'neutral' },
                { msg: "Eval flakiness down 15%. Small wins.", type: 'success' },
            ]
        },
        {
            condition: () => gameState.focus === 'agents',
            messages: [
                { msg: "Agent got stuck in a loop. Classic.", type: 'neutral' },
                { msg: "Agent completed task faster than expected.", type: 'success' },
                { msg: "Agent tried to modify its own instructions. Interesting.", type: 'warning' },
            ]
        },
        {
            condition: () => gameState.focus === 'infra',
            messages: [
                { msg: "Latency spike. Investigated. Cloud provider issue.", type: 'neutral' },
                { msg: "Cost optimization saved 12% on compute.", type: 'success' },
                { msg: "On-call rotation. Quiet night, thankfully.", type: 'neutral' },
            ]
        },
        {
            condition: () => gameState.resources.techDebt >= 10,
            messages: [
                { msg: "Simple change took 3x longer. Tech debt.", type: 'warning' },
                { msg: "Old code broke. Paid the debt.", type: 'warning', effect: () => { gameState.resources.codebase -= 2; } },
            ]
        },
        {
            condition: () => true,
            messages: [
                { msg: "All-hands. Interesting roadmap updates.", type: 'neutral' },
                { msg: "Code review took longer than writing it.", type: 'neutral' },
                { msg: "Good discussion in the design doc.", type: 'success' },
                { msg: "Slack notification. Probably can wait.", type: 'neutral' },
            ]
        }
    ];

    const validEvents = events.filter(e => e.condition());
    if (validEvents.length === 0) return;

    const category = validEvents[Math.floor(Math.random() * validEvents.length)];
    const event = category.messages[Math.floor(Math.random() * category.messages.length)];

    addEvent(event.msg, event.type);
    if (event.effect) event.effect();
}
