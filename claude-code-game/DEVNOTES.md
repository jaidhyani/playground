# Development Notes - Claude Code: The Game

## Current Status
**MVP COMPLETE** - First playable draft is fully functional!

## What's Working

### Core Mechanics
- [x] Click-to-fix-bug main action
- [x] Passive resource generation (utility, money, compute)
- [x] Multipliers applied correctly
- [x] Rates display updating in real-time

### Upgrade System (8 early upgrades)
- [x] Bug Bot v1 - passive utility
- [x] Code Reviewer - passive utility + alignment bonus
- [x] Metrics Dashboard - passive money
- [x] Coffee Bot - utility multiplier
- [x] Auto Deploy - passive utility, alignment penalty
- [x] User Feedback - utility + money, alignment bonus
- [x] Server Cluster - passive compute
- [x] AI Coding Assistant - triggers mid-game transition

### Choice System (6 choices total)
- [x] Privacy vs Metrics (early)
- [x] Rush vs Quality (early)
- [x] Automation Decision (early)
- [x] RLHF Pressure (mid)
- [x] Competitor Response (mid)
- [x] Verification Cost (mid)

### Research System (8 projects)
- [x] Scale Up Training
- [x] RLHF Research
- [x] Constitutional AI
- [x] Interpretability Research
- [x] Agent Frameworks
- [x] Self-Improvement Loops
- [x] Safety Research
- [x] Competitive Intelligence

### Phase Transitions
- [x] Early → Mid (AI Assistant + capability + money threshold)
- [x] Mid → Late (capability threshold OR self-improvement research)

### Competitor Mechanics
- [x] Progress advances over time in mid/late game
- [x] Player capability slows competitor
- [x] Events at 25%, 50%, 75%, 90% thresholds
- [x] Competitor reaching 100% = loss ending

### Ending System (7 endings)
- [x] Competitor Wins (competitor reaches 100%)
- [x] Stagnation (too slow in late game)
- [x] Deceptive Alignment (alignment < 20)
- [x] Misalignment/Maximum Utility (alignment 20-40)
- [x] Loss of Control (alignment 40-50)
- [x] Uncertain Victory (alignment 50-70)
- [x] Golden Path (alignment >= 70)

### Hidden Feedback
- [x] Flavor text varies based on alignment
- [x] Different click messages per phase and alignment level

### Save/Load
- [x] Auto-save every 30 seconds
- [x] Manual save/load buttons
- [x] Reset game with confirmation

## Balance Notes (from testing)
- Early game takes ~50 clicks to get AI Assistant (~5 minutes of active clicking)
- Money generation is the bottleneck early on
- Choices have significant alignment impact (±3-15 per choice)
- Competitor advances ~0.3/sec in mid game, ~0.5/sec in late
- Golden path requires careful choice management throughout

## Ideas for Future Iterations
- Sound effects for purchases/events
- More mid-game upgrades
- Late-game specific mechanics
- Achievement system
- More varied choice consequences
- Visual polish (animations, particles)
- Mobile-friendly touch targets

## Known Issues
- None critical for MVP

## Testing Performed
- [x] Fresh game start
- [x] Click action works
- [x] Upgrades unlock and purchase correctly
- [x] Choices trigger and apply effects
- [x] Phase transitions work
- [x] Research system functional
- [x] Competitor progress advances
- [x] Endings trigger correctly
- [x] Save/load works
- [x] Passive generation accumulates over time
