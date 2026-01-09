/**
 * Tests for game state and visibility helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { gameState, hasUpgrade, visibility } from '../../js/state.js';

// Helper to reset relevant state before each test
function resetState() {
    gameState.resources.techDebt = 0;
    gameState.resources.apiCredits = 0;
    gameState.resources.money = 0;
    gameState.clickMultiplier = 1;
    gameState.upgrades = [];
    gameState.declinedUpgrades = [];
    gameState.narrative.flags = {};
    gameState.settings.claudeCodeAssist = false;
}

describe('hasUpgrade', () => {
    beforeEach(resetState);

    it('returns false when upgrade not taken', () => {
        expect(hasUpgrade('autoMerge')).toBe(false);
    });

    it('returns true when upgrade taken', () => {
        gameState.upgrades.push('autoMerge');

        expect(hasUpgrade('autoMerge')).toBe(true);
    });

    it('returns true when upgrade was declined', () => {
        gameState.declinedUpgrades.push('autoMerge');

        expect(hasUpgrade('autoMerge')).toBe(true);
    });
});

describe('visibility.techDebt', () => {
    beforeEach(resetState);

    it('returns false when techDebt is 0', () => {
        expect(visibility.techDebt()).toBe(false);
    });

    it('returns true when techDebt > 0', () => {
        gameState.resources.techDebt = 5;

        expect(visibility.techDebt()).toBe(true);
    });
});

describe('visibility.multiplier', () => {
    beforeEach(resetState);

    it('returns false before Claude Code unlocked', () => {
        expect(visibility.multiplier()).toBe(false);
    });

    it('returns true after Claude Code unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;

        expect(visibility.multiplier()).toBe(true);
    });
});

describe('visibility.apiCredits', () => {
    beforeEach(resetState);

    it('returns false before Claude Code unlocked', () => {
        expect(visibility.apiCredits()).toBe(false);
    });

    it('returns true after Claude Code unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;

        expect(visibility.apiCredits()).toBe(true);
    });
});

describe('visibility.money', () => {
    beforeEach(resetState);

    it('returns false initially', () => {
        expect(visibility.money()).toBe(false);
    });

    it('returns true when moneyRevealed flag set', () => {
        gameState.narrative.flags.moneyRevealed = true;

        expect(visibility.money()).toBe(true);
    });

    it('returns true when Claude Code unlocked and credits low', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.resources.apiCredits = 30;

        expect(visibility.money()).toBe(true);
    });

    it('returns false when Claude Code unlocked but credits sufficient', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;
        gameState.resources.apiCredits = 100;

        expect(visibility.money()).toBe(false);
    });
});

describe('visibility.claudeCodeToggle', () => {
    beforeEach(resetState);

    it('returns false before Claude Code unlocked', () => {
        expect(visibility.claudeCodeToggle()).toBe(false);
    });

    it('returns true after Claude Code unlocked', () => {
        gameState.narrative.flags.claudeCodeUnlocked = true;

        expect(visibility.claudeCodeToggle()).toBe(true);
    });
});
