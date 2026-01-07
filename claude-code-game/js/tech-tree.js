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
            { id: 'prototype', name: '[Dev] Claude Code Prototype', devPoints: 50, oneOff: true }
        ],
        unlockedBy: null
    },

    // Phase 1: Basic infrastructure (unlocked by prototype)
    phase1: {
        tasks: [
            { id: 'tool-calling', name: '[Dev] Basic tool calling', devPoints: 35, oneOff: true },
            { id: 'error-handling', name: '[Dev] Error handling', devPoints: 25 },
            { id: 'streaming', name: '[Dev] Streaming responses', devPoints: 30, oneOff: true }
        ],
        unlockedBy: '[Dev] Claude Code Prototype',
        message: null  // Shown in the prototype merge message instead
    },

    // Phase 2: MCP protocol (unlocked by tool calling)
    phase2: {
        tasks: [
            { id: 'mcp-spec', name: '[Dev] MCP protocol spec', devPoints: 45, oneOff: true },
            { id: 'tool-discovery', name: '[Dev] Tool discovery', devPoints: 30 }
        ],
        unlockedBy: '[Dev] Basic tool calling',
        message: 'Tool calling working. MCP protocol next.'
    },

    // Phase 3: MCP servers (unlocked by MCP spec)
    phase3: {
        tasks: [
            { id: 'mcp-filesystem', name: '[Dev] Filesystem MCP server', devPoints: 40, oneOff: true },
            { id: 'mcp-git', name: '[Dev] Git MCP server', devPoints: 40, oneOff: true },
            { id: 'server-templates', name: '[Dev] MCP server templates', devPoints: 35 }
        ],
        unlockedBy: '[Dev] MCP protocol spec',
        message: 'MCP spec complete. Server ecosystem unlocked.'
    },

    // Phase 4: Agent capabilities (unlocked by filesystem server)
    phase4: {
        tasks: [
            { id: 'agent-loop', name: '[Dev] Agent loop', devPoints: 50, oneOff: true },
            { id: 'context-management', name: '[Dev] Context management', devPoints: 40 },
            { id: 'task-decomposition', name: '[Dev] Task decomposition', devPoints: 45, oneOff: true }
        ],
        unlockedBy: '[Dev] Filesystem MCP server',
        message: 'Filesystem access enables agentic workflows.'
    },

    // Phase 5: Evaluation & safety (unlocked by agent loop)
    phase5: {
        tasks: [
            { id: 'eval-framework', name: '[Dev] Eval framework', devPoints: 50, oneOff: true },
            { id: 'benchmark-suite', name: '[Dev] Benchmark suite', devPoints: 40 },
            { id: 'safety-checks', name: '[Dev] Safety checks', devPoints: 45 }
        ],
        unlockedBy: '[Dev] Agent loop',
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
