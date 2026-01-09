---
description: Generate an image using Gemini 3 Pro (Nano Banana Pro)
argument-hint: "<prompt> [--aspect 16:9] [--size 2K] [--ref path] [--output path]"
allowed-tools: Bash(uv:*)
---

Generate an image using Google's Gemini 3 Pro Image model.

Parse the user's arguments from: $ARGUMENTS

The arguments follow this pattern:
- Everything before the first `--` flag is the prompt
- Optional flags: `--aspect`, `--size`, `--ref`, `--output`

Build and run the command:

```bash
uv run "${CLAUDE_PLUGIN_ROOT}/scripts/generate.py" --prompt "<extracted prompt>" [other flags]
```

**Defaults:**
- Aspect ratio: 1:1 (square)
- Size: 2K
- Output: ./generated/image_<timestamp>.png

**Valid options:**
- `--aspect`: 1:1, 16:9, 9:16, 4:3, 3:4
- `--size`: 1K, 2K, 4K
- `--ref`: Path to reference image
- `--output`: Custom output path

After generation, report the saved image path to the user.
