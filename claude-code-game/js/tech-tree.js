/**
 * Tech Tree - DAG of Claude Code development tasks
 *
 * Each node is a task with dependencies (requires array).
 * Tasks become available when all their dependencies are completed.
 * oneOff tasks disappear after completion; others can be repeated.
 */

export const techTree = {
    // Starting node - no dependencies
    'prototype': {
        name: '[Dev] Claude Code Prototype',
        devPoints: 50,
        oneOff: true,
        requires: [],
        message: null  // Message shown in PR merge instead
    },

    // Basic infrastructure - unlocked by prototype
    'tool-calling': {
        name: '[Dev] Basic tool calling',
        devPoints: 35,
        oneOff: true,
        requires: ['prototype'],
        message: 'Tool calling working. MCP protocol next.'
    },
    'error-handling': {
        name: '[Dev] Error handling',
        devPoints: 25,
        oneOff: false,
        requires: ['prototype']
    },
    'streaming': {
        name: '[Dev] Streaming responses',
        devPoints: 30,
        oneOff: true,
        requires: ['prototype']
    },

    // MCP protocol - unlocked by tool calling
    'mcp-spec': {
        name: '[Dev] MCP protocol spec',
        devPoints: 45,
        oneOff: true,
        requires: ['tool-calling'],
        message: 'MCP spec complete. Server ecosystem unlocked.'
    },
    'tool-discovery': {
        name: '[Dev] Tool discovery',
        devPoints: 30,
        oneOff: false,
        requires: ['tool-calling']
    },

    // MCP servers - unlocked by MCP spec
    'mcp-filesystem': {
        name: '[Dev] Filesystem MCP server',
        devPoints: 40,
        oneOff: true,
        requires: ['mcp-spec'],
        message: 'Filesystem access enables agentic workflows.'
    },
    'mcp-git': {
        name: '[Dev] Git MCP server',
        devPoints: 40,
        oneOff: true,
        requires: ['mcp-spec']
    },
    'server-templates': {
        name: '[Dev] MCP server templates',
        devPoints: 35,
        oneOff: false,
        requires: ['mcp-spec']
    },

    // Agent capabilities - unlocked by filesystem server
    'agent-loop': {
        name: '[Dev] Agent loop',
        devPoints: 50,
        oneOff: true,
        requires: ['mcp-filesystem'],
        message: 'Agents need evals. Measurement unlocked.'
    },
    'context-management': {
        name: '[Dev] Context management',
        devPoints: 40,
        oneOff: false,
        requires: ['mcp-filesystem']
    },
    'task-decomposition': {
        name: '[Dev] Task decomposition',
        devPoints: 45,
        oneOff: true,
        requires: ['mcp-filesystem', 'agent-loop']  // requires both
    },

    // Evaluation & safety - unlocked by agent loop
    'eval-framework': {
        name: '[Dev] Eval framework',
        devPoints: 50,
        oneOff: true,
        requires: ['agent-loop']
    },
    'benchmark-suite': {
        name: '[Dev] Benchmark suite',
        devPoints: 40,
        oneOff: false,
        requires: ['agent-loop']
    },
    'safety-checks': {
        name: '[Dev] Safety checks',
        devPoints: 45,
        oneOff: false,
        requires: ['agent-loop', 'eval-framework']  // requires both
    }
};

/**
 * Get tasks that are available given a set of completed task IDs
 */
export function getAvailableTasks(completedTaskIds) {
    const completed = new Set(completedTaskIds);
    const available = [];

    for (const [taskId, task] of Object.entries(techTree)) {
        // Skip already completed one-off tasks
        if (task.oneOff && completed.has(taskId)) continue;

        // Check if all requirements are met
        const requirementsMet = task.requires.every(reqId => completed.has(reqId));
        if (requirementsMet) {
            available.push({ id: taskId, ...task });
        }
    }

    return available;
}

/**
 * Get the task definition by ID
 */
export function getTask(taskId) {
    const task = techTree[taskId];
    if (!task) return null;
    return { id: taskId, ...task };
}

/**
 * Get all tasks that directly depend on a given task
 */
export function getDependents(taskId) {
    const dependents = [];
    for (const [id, task] of Object.entries(techTree)) {
        if (task.requires.includes(taskId)) {
            dependents.push({ id, ...task });
        }
    }
    return dependents;
}

/**
 * Get starting tasks (no dependencies)
 */
export function getStartingTasks() {
    return getAvailableTasks([]);
}
