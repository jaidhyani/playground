# Pluribus

A low-friction playground for experimenting with random projects. Each subdirectory is an independent project with its own purpose and stack.

## Projects

| Project | Description |
|---------|-------------|
| **claude-code-game** | Incremental/idle game where you play as an engineer at Anthropic working on Claude Code |
| **clarvis** | Web UI for the Claude Agent SDK with multi-session management |
| **imagine** | Claude plugin for image generation via Google Gemini |
| **tab-overview-extension** | Chrome extension providing Safari-style grid/list view of open tabs |

## Getting Started

Each project is self-contained. Navigate to any project directory and follow its specific setup:

```bash
# Example: Run the Claude Code game tests
cd claude-code-game
npm test

# Example: Start the Clarvis server
cd clarvis
./start.sh

# Example: Generate an image with Imagine
cd imagine/scripts
uv run generate.py --prompt "your description"
```

See individual project folders for detailed instructions.
