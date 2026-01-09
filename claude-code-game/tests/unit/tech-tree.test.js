/**
 * Tests for tech tree DAG logic
 */

import { describe, it, expect } from 'vitest';
import { getAvailableTasks, getStartingTasks, getTask, getDependents } from '../../js/tech-tree.js';

describe('getStartingTasks', () => {
    it('returns only tasks with no dependencies', () => {
        const tasks = getStartingTasks();

        expect(tasks.length).toBe(1);
        expect(tasks[0].id).toBe('prototype');
        expect(tasks[0].requires).toEqual([]);
    });
});

describe('getAvailableTasks', () => {
    it('returns starting tasks when nothing completed', () => {
        const tasks = getAvailableTasks([]);

        expect(tasks.length).toBe(1);
        expect(tasks[0].id).toBe('prototype');
    });

    it('unlocks dependent tasks after completing prototype', () => {
        const tasks = getAvailableTasks(['prototype']);
        const taskIds = tasks.map(t => t.id);

        expect(taskIds).toContain('tool-calling');
        expect(taskIds).toContain('error-handling');
        expect(taskIds).toContain('streaming');
        expect(taskIds).not.toContain('prototype'); // one-off, already done
    });

    it('does not unlock tasks with unmet dependencies', () => {
        const tasks = getAvailableTasks(['prototype']);
        const taskIds = tasks.map(t => t.id);

        // mcp-spec requires tool-calling, which isn't complete
        expect(taskIds).not.toContain('mcp-spec');
    });

    it('unlocks tasks when all dependencies met', () => {
        const tasks = getAvailableTasks(['prototype', 'tool-calling']);
        const taskIds = tasks.map(t => t.id);

        expect(taskIds).toContain('mcp-spec');
        expect(taskIds).toContain('tool-discovery');
    });

    it('handles multi-dependency tasks correctly', () => {
        // task-decomposition requires both mcp-filesystem AND agent-loop
        const withOnlyFilesystem = getAvailableTasks([
            'prototype', 'tool-calling', 'mcp-spec', 'mcp-filesystem'
        ]);
        expect(withOnlyFilesystem.map(t => t.id)).not.toContain('task-decomposition');

        const withBoth = getAvailableTasks([
            'prototype', 'tool-calling', 'mcp-spec', 'mcp-filesystem', 'agent-loop'
        ]);
        expect(withBoth.map(t => t.id)).toContain('task-decomposition');
    });

    it('keeps repeatable tasks available after completion', () => {
        const tasks = getAvailableTasks(['prototype', 'error-handling']);
        const taskIds = tasks.map(t => t.id);

        // error-handling is not oneOff, so it should still be available
        expect(taskIds).toContain('error-handling');
    });
});

describe('getTask', () => {
    it('returns task by id with id included', () => {
        const task = getTask('prototype');

        expect(task).not.toBeNull();
        expect(task.id).toBe('prototype');
        expect(task.name).toBe('[Dev] Claude Code Prototype');
        expect(task.devPoints).toBe(50);
    });

    it('returns null for unknown task', () => {
        expect(getTask('nonexistent')).toBeNull();
    });
});

describe('getDependents', () => {
    it('returns tasks that depend on given task', () => {
        const dependents = getDependents('prototype');
        const ids = dependents.map(d => d.id);

        expect(ids).toContain('tool-calling');
        expect(ids).toContain('error-handling');
        expect(ids).toContain('streaming');
    });

    it('returns empty array for leaf tasks', () => {
        const dependents = getDependents('safety-checks');

        expect(dependents).toEqual([]);
    });
});
