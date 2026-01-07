# Claude Code Game - Project Context

## What This Is

An incremental game inspired by Universal Paperclips. You play as an engineer at Anthropic working on Claude Code.

## Core Design Principles

1. **Inside baseball** - Target audience knows what MCP servers, evals, and METR time horizons are
2. **Terse** - Short messages, let imagination fill gaps
3. **No generic dev stuff** - No GitHub stars, Twitter, HN posts. This is Anthropic-specific
4. **Energy is the constraint** - Not money. You have a salary. Burnout is the risk
5. **Trust matters** - Internal autonomy, not external reputation

## Architecture

```
js/
  state.js    - Game state (resources, settings, narrative)
  actions.js  - What you can do (code, vibe, rest, ship, refactor)
  upgrades.js - Decisions that unlock/branch gameplay
  events.js   - Random events, narrative triggers
  prs.js      - PR generation and merging
  render.js   - DOM updates
  main.js     - Game loop, init
  save.js     - LocalStorage persistence
```

## Resources

- **energy** (0-100): Focus/motivation. Regenerates slowly. Zero = burnout
- **codebase**: Claude Code quality/features. Grows through work
- **techDebt**: Shortcuts. Slows future work, causes bugs
- **trust** (0-100): Internal autonomy. Low = oversight. Zero = fired

## Key Decisions

Unlocks based on codebase size or manual code clicks:

- **focus**: MCP servers, agents, evals, or infrastructure
- **vibeMode**: Let Claude write the code vs write it yourself
- **autoMerge**: Auto-merge PRs vs manual review
- **architectureChoice**: Ship fast vs do it right

## Files to Know

- `dev/GAME_DESIGN.md` - High-level design doc
- `dev/MECHANICS.md` - Detailed mechanics
- `dev/NARRATIVE.md` - Story and tone
- `dev/CUT_CONTENT.md` - Features removed during simplification

## Current State

Simplified MVP. Start screen has one action: "write code".
Decisions appear as contextual buttons with legible labels.
No money pressure - you work at Anthropic.

## Style Guide

- Lowercase buttons except proper nouns (MCP, Claude)
- Event messages: short, dry, no exclamation points
- Energy costs shown as "(X energy)" not just "(X)"
- Upgrade labels should be self-explanatory without context

## Don't

- Add GitHub stars, Twitter, HN mechanics
- Add money/rent pressure
- Use generic dev tropes (coffee, ergonomics, standing desks)
- Add verbose descriptions - keep it terse
