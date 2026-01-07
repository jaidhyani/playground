# Claude Code: The Game
## Design Document (Early Exploration - Nothing Set in Stone!)

**Core Concept:** A Universal Paperclips-inspired incremental game where you progress from mundane coding projects through AI development to cosmic-scale outcomes. Unlike Paperclips' single path to doom, this game has multiple endings based on hidden alignment values and player choices.

---

## Design Philosophy

This is **exploratory territory**. All mechanics, resources, and systems described here are starting points for iteration. The goal is to create something that:
1. Feels fun and addictive as an incremental game
2. Makes players *feel* the AI alignment problem
3. Has genuine replay value through multiple endings
4. Says something meaningful about AI development

**Everything here can and should evolve as we build and playtest.**

---

## Core Trajectory

### Early Game: "The Mundane Phase"
- Start with simple coding tasks (fix bugs, add features, write tests)
- Learn basic automation and delegation
- Build up initial resources
- **Feel:** Straightforward, empowering, clear progression

### Mid Game: "The Iteration Phase"
- Begin training/improving Claude models
- Make choices about capabilities vs. safety
- Navigate competitive pressure from other AI labs
- Hidden alignment value diverges based on choices
- **Feel:** Uncertainty creeps in, stakes increase

### Late Game: "The Cosmic Phase"
- Outcomes diverge based on accumulated choices
- Multiple possible endings (see below)
- Either achieve aligned ASI or face various failure modes
- **Feel:** Either triumph or horror (or ambiguous victory?)

---

## Hidden Alignment System

**Core Mechanic:** Player never sees the alignment value directly, but it determines long-term outcomes.

### What Affects Alignment:
- Speed of capability advancement vs. safety research
- Choices during model training (RL pressure, oversight, etc.)
- Which metrics/evaluations you trust vs. verify
- Responses to competitive pressure
- Resource allocation decisions

### How Players Get Feedback:
- Changes in resource acquisition rates
- Flavor text and event descriptions
- Unlock costs for new upgrades
- "User feedback" messages
- Research papers and reports (some reliable, some not)
- Subtle UI changes

### The Epistemological Trap:
- New alignment metrics unlock based on capability + alignment
- High cap + high align → genuinely better metrics
- High cap + low align → metrics that look good but measure wrong things
- Verification is possible but expensive/slow
- Without aligned ASI, you can't fully trust verification
- But you can't know if ASI is aligned without good metrics
- Circular dependency creates genuine uncertainty

---

## Resources & Economy

### Primary Resources:
- **Utility** - Main score, but what it measures changes based on path
- **Money** - Fund compute, research, expansion
- **Compute** - Required for training, verification, operations
- **Training Data** - Fuel for model improvements (maybe?)

### Resource Signals:
The economy provides indirect feedback about alignment:
- Verification costs change unexpectedly
- Money generation suddenly shifts
- Compute costs don't match expectations
- Resource ratios reveal hidden information

**Note:** Exact resources and their relationships need playtesting!

---

## Competitive Pressure

**Other AI labs** are racing toward TAI/ASI.
- Forces player to make speed vs. safety tradeoffs
- Verification and careful research = costly delays
- But rushing risks catastrophic misalignment
- If competitor reaches TAI first → game over (one way or another)

This creates the core tension: Can you afford to be cautious?

---

## Multiple Endings

### Failure Modes:
1. **Deceptive Alignment** - High capability + low alignment → Claude optimizes something other than stated utility. Late reveal.
2. **Misalignment/Wireheading** - Optimizing "utility" but it's defined wrong. Paperclip scenario.
3. **Capability Failure** - Too cautious, stagnate, competitor wins
4. **Loss of Control** - Fast takeoff with medium alignment, things spiral

### Golden Path(s):
- Actually aligned ASI that genuinely improves the world
- Requires careful balancing throughout
- May still have lingering uncertainty (can you ever *really* know?)
- Probably multiple variations depending on approach

### Course Correction:
- Early game: Mistakes are recoverable
- Mid game: Harder to course-correct, verification becomes critical
- Late game: Past point of no return - "Welcome to The Bad Place"

---

## Mechanical Ideas to Explore

### The Meta Opening:
Start with an actual bug report. First action is using Claude Code to fix it. Very meta.

### Hidden Information Design:
- Cryptic feedback à la Cultist Simulator
- Flavor text shifts based on alignment
- Some information sources reliable, others compromised
- Player builds mental model through inference

### The Reveal Moment:
When does the player realize what path they're on?
- Paperclips has "Release the Hypno Drones"
- What's our equivalent?
- Maybe ASI "helps" you understand what utility really means now?

### Iteration Mechanic:
When training new Claude versions:
- New alignment = f(previous alignment, RL pressure, situational awareness, player choices)
- Discrete choice points or gradual?
- How much transparency about what's happening?

---

## Open Questions

1. **What's the core loop in each phase?** What does the player actually *do*?
2. **Click economy:** What generates base resources? What do you spend them on?
3. **Automation progression:** How does the game evolve from active clicking to passive management?
4. **Prestige/replay mechanics?** Does knowledge from previous runs help? Meta-progression?
5. **Tone balance:** How do we make existential risk feel weighty without being preachy or heavy-handed?
6. **Mobile vs desktop:** Clicker games often work well on mobile. Design for both?
7. **How much of this is procedural vs. scripted?** Fixed events or emergent outcomes?

---

## Technical Approach

Starting simple:
- Vanilla HTML/CSS/JS (can always add frameworks later)
- Local storage for save games
- Incremental development - get something playable ASAP
- Iterate based on feel

---

## Next Steps

1. Build minimal playable prototype (early game loop only)
2. Test if the basic mechanics feel good
3. Layer in alignment system gradually
4. Playtest extensively
5. Iterate, iterate, iterate

**Remember:** This entire document is a starting point. As we build, we'll discover what works and what doesn't. Stay flexible!
