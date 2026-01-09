/**
 * DOM tests for rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDOM, teardownDOM, resetGameState, getElement, isVisible, getText } from './test-utils.js';
import { gameState } from '../../js/state.js';
import { renderResources, renderButtons } from '../../js/render.js';

describe('renderResources', () => {
    beforeEach(() => {
        setupDOM();
        resetGameState();
    });

    afterEach(teardownDOM);

    it('renders codebase value', () => {
        gameState.resources.codebase = 42;

        renderResources();

        expect(getText('codebase')).toBe('42');
    });

    it('renders trust value', () => {
        gameState.resources.trust = 75;

        renderResources();

        expect(getText('trust')).toBe('75');
    });

    it('hides tech debt when zero', () => {
        gameState.resources.techDebt = 0;

        renderResources();

        expect(isVisible('tech-debt-display')).toBe(false);
    });

    it('shows tech debt when positive', () => {
        gameState.resources.techDebt = 10;

        renderResources();

        expect(isVisible('tech-debt-display')).toBe(true);
        expect(getText('techDebt')).toBe('10');
    });

    it('hides multiplier before Claude Code unlocked', () => {
        renderResources();

        expect(isVisible('multiplier-display')).toBe(false);
    });

    it('shows multiplier after Claude Code unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.clickMultiplier = 1.2;

        renderResources();

        expect(isVisible('multiplier-display')).toBe(true);
        expect(getText('multiplier')).toBe('1.2x');
    });

    it('shows API credits after Claude Code unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.resources.apiCredits = 100;

        renderResources();

        expect(isVisible('api-credits-display')).toBe(true);
        expect(getText('apiCredits')).toBe('100');
    });

    it('formats date correctly', () => {
        gameState.gameDate = new Date(2025, 0, 6); // Mon Jan 6

        renderResources();

        expect(getText('game-date')).toBe('Mon Jan 6');
    });
});

describe('renderButtons', () => {
    beforeEach(() => {
        setupDOM();
        resetGameState();
    });

    afterEach(teardownDOM);

    it('shows Claude Code toggle when unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.resources.apiCredits = 50;

        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        expect(buttons).toContain('Claude Code:');
        expect(buttons).toContain('OFF');
    });

    it('shows toggle as ON when assist enabled', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.resources.apiCredits = 50;
        gameState.settings.claudeCodeAssist = true;

        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        expect(buttons).toContain('ON');
        expect(buttons).toContain('2x dev');
    });

    it('renders tasks as progress buttons', () => {
        gameState.tasks = [
            { id: 'test-task', name: '[Dev] Test Task', devPoints: 50, progress: 25 }
        ];

        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        expect(buttons).toContain('[Dev] Test Task');
        expect(buttons).toContain('25.00/50');
    });

    it('renders PRs before tasks', () => {
        gameState.tasks = [{ id: 't1', name: 'Task', devPoints: 10, progress: 0 }];
        gameState.prQueue = [{ id: 1, title: 'Fix bug', quality: 0.8 }];

        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        const prIndex = buttons.indexOf('PR:');
        const taskIndex = buttons.indexOf('Task');
        expect(prIndex).toBeLessThan(taskIndex);
    });

    it('marks risky PRs with warning', () => {
        gameState.prQueue = [{ id: 1, title: 'Risky change', quality: 0.2 }];

        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        expect(buttons).toContain('⚠');
        expect(buttons).toContain('risky');
    });

    it('hides Claude Code toggle when not unlocked', () => {
        renderButtons();

        const buttons = getElement('buttons').innerHTML;
        expect(buttons).not.toContain('Claude Code:');
    });
});
