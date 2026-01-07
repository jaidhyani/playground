/**
 * Tech Tree - The progression of Claude Code development
 *
 * Each phase unlocks after completing a key task from the previous phase.
 * Tasks with oneOff: true disappear after completion.
 */

export const techTree = {
    // Phase 0: The beginning
    initial: {
        tasks: [
            { id: 'prototype', name: 'Claude Code Prototype', clicksNeeded: 50, oneOff: true }
        ],
        unlockedBy: null
    },

    // Phase 1: Basic infrastructure (unlocked by prototype)
    phase1: {
        tasks: [
            { id: 'tool-calling', name: 'Basic tool calling', clicksNeeded: 35, oneOff: true },
            { id: 'error-handling', name: 'Error handling', clicksNeeded: 25 },
            { id: 'streaming', name: 'Streaming responses', clicksNeeded: 30, oneOff: true }
        ],
        unlockedBy: 'Claude Code Prototype',
        message: null  // Shown in the prototype merge message instead
    },

    // Phase 2: MCP protocol (unlocked by tool calling)
    phase2: {
        tasks: [
            { id: 'mcp-spec', name: 'MCP protocol spec', clicksNeeded: 45, oneOff: true },
            { id: 'tool-discovery', name: 'Tool discovery', clicksNeeded: 30 }
        ],
        unlockedBy: 'Basic tool calling',
        message: 'Tool calling working. MCP protocol next.'
    },

    // Phase 3: MCP servers (unlocked by MCP spec)
    phase3: {
        tasks: [
            { id: 'mcp-filesystem', name: 'Filesystem MCP server', clicksNeeded: 40, oneOff: true },
            { id: 'mcp-git', name: 'Git MCP server', clicksNeeded: 40, oneOff: true },
            { id: 'server-templates', name: 'MCP server templates', clicksNeeded: 35 }
        ],
        unlockedBy: 'MCP protocol spec',
        message: 'MCP spec complete. Server ecosystem unlocked.'
    },

    // Phase 4: Agent capabilities (unlocked by filesystem server)
    phase4: {
        tasks: [
            { id: 'agent-loop', name: 'Agent loop', clicksNeeded: 50, oneOff: true },
            { id: 'context-management', name: 'Context management', clicksNeeded: 40 },
            { id: 'task-decomposition', name: 'Task decomposition', clicksNeeded: 45, oneOff: true }
        ],
        unlockedBy: 'Filesystem MCP server',
        message: 'Filesystem access enables agentic workflows.'
    },

    // Phase 5: Evaluation & safety (unlocked by agent loop)
    phase5: {
        tasks: [
            { id: 'eval-framework', name: 'Eval framework', clicksNeeded: 50, oneOff: true },
            { id: 'benchmark-suite', name: 'Benchmark suite', clicksNeeded: 40 },
            { id: 'safety-checks', name: 'Safety checks', clicksNeeded: 45 }
        ],
        unlockedBy: 'Agent loop',
        message: 'Agents need evals. Measurement unlocked.'
    }
};

/**
 * Get the phase that should unlock when a PR with this title is merged
 */
export function getPhaseUnlockedBy(prTitle) {
    for (const [phaseId, phase] of Object.entries(techTree)) {
        if (phase.unlockedBy === prTitle) {
            return { phaseId, phase };
        }
    }
    return null;
}
