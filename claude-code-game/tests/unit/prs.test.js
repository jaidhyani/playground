/**
 * Tests for PR generation
 */

import { describe, it, expect } from 'vitest';
import { generatePR } from '../../js/prs.js';

describe('generatePR', () => {
    it('creates PR with expected properties', () => {
        const pr = generatePR(0.7, 'test-task', 'Test Task Name');

        expect(pr).toHaveProperty('id');
        expect(pr).toHaveProperty('title');
        expect(pr).toHaveProperty('quality');
        expect(pr).toHaveProperty('codebaseGain');
        expect(pr).toHaveProperty('techDebtGain');
        expect(pr).toHaveProperty('hasBug');
        expect(pr).toHaveProperty('isPrototype');
    });

    it('uses task name as title when provided', () => {
        const pr = generatePR(0.7, 'some-task', 'My Custom Title');

        expect(pr.title).toBe('My Custom Title');
    });

    it('marks prototype PRs correctly', () => {
        const prototypePR = generatePR(0.8, 'prototype', 'Prototype');
        const regularPR = generatePR(0.8, 'other-task', 'Other');

        expect(prototypePR.isPrototype).toBe(true);
        expect(regularPR.isPrototype).toBe(false);
    });

    it('calculates codebase gain based on quality', () => {
        const lowQuality = generatePR(0.0, null, null);
        const highQuality = generatePR(1.0, null, null);

        // Formula: 3 + quality * 7, so range is 3-10
        expect(lowQuality.codebaseGain).toBe(3);
        expect(highQuality.codebaseGain).toBe(10);
    });

    it('adds tech debt for low quality PRs', () => {
        const lowQuality = generatePR(0.2, null, null);
        const highQuality = generatePR(0.8, null, null);

        expect(lowQuality.techDebtGain).toBeGreaterThan(0);
        expect(highQuality.techDebtGain).toBe(0);
    });

    it('increments PR id for each call', () => {
        const pr1 = generatePR(0.5, null, null);
        const pr2 = generatePR(0.5, null, null);

        expect(pr2.id).toBe(pr1.id + 1);
    });
});
