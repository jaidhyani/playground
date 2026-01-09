#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai",
#     "pillow",
# ]
# ///
"""
Generate images using Google's Gemini 3 Pro Image (Nano Banana Pro).

Usage:
    uv run generate.py --prompt "A colorful abstract pattern"
    uv run generate.py --prompt "Hero image" --aspect 16:9 --size 4K
    uv run generate.py --prompt "Similar style" --ref ./existing.png
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image


ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"]
IMAGE_SIZES = ["1K", "2K", "4K"]


def generate_image(
    prompt: str,
    output_path: str | None = None,
    aspect: str = "1:1",
    size: str = "2K",
    reference: str | None = None,
) -> None:
    """Generate an image using Gemini 3 Pro and save to output_path."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    if aspect not in ASPECT_RATIOS:
        print(f"Error: Invalid aspect ratio '{aspect}'. Valid options: {ASPECT_RATIOS}", file=sys.stderr)
        sys.exit(1)

    if size not in IMAGE_SIZES:
        print(f"Error: Invalid size '{size}'. Valid options: {IMAGE_SIZES}", file=sys.stderr)
        sys.exit(1)

    # Default output path with timestamp
    if not output_path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path("./generated")
        output_dir.mkdir(exist_ok=True)
        output_path = str(output_dir / f"image_{timestamp}.png")

    client = genai.Client(api_key=api_key)

    # Build contents with optional reference image
    contents: list = []
    if reference:
        ref_path = Path(reference)
        if not ref_path.exists():
            print(f"Error: Reference image not found: {reference}", file=sys.stderr)
            sys.exit(1)
        ref_image = Image.open(ref_path)
        contents.append(ref_image)
        prompt = f"{prompt} Use the provided image as a reference for style, composition, or content."
    contents.append(prompt)

    print(f"Generating image with Gemini 3 Pro...")
    print(f"  Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}")
    print(f"  Aspect: {aspect}, Size: {size}")

    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=aspect,
                image_size=size,
            ),
        ),
    )

    # Ensure output directory exists
    output_dir = Path(output_path).parent
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    # Extract image from response
    for part in response.parts:
        if part.text is not None:
            print(f"Model response: {part.text}")
        elif part.inline_data is not None:
            image = part.as_image()
            image.save(output_path)
            print(f"Image saved to: {output_path}")
            return

    print("Error: No image data in response", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Gemini 3 Pro (Nano Banana Pro)"
    )
    parser.add_argument(
        "--prompt",
        required=True,
        help="Description of the image to generate",
    )
    parser.add_argument(
        "--output",
        help="Output file path (default: ./generated/image_<timestamp>.png)",
    )
    parser.add_argument(
        "--aspect",
        choices=ASPECT_RATIOS,
        default="1:1",
        help="Aspect ratio (default: 1:1)",
    )
    parser.add_argument(
        "--size",
        choices=IMAGE_SIZES,
        default="2K",
        help="Image size (default: 2K)",
    )
    parser.add_argument(
        "--ref",
        help="Path to a reference image for style/composition guidance",
    )

    args = parser.parse_args()
    generate_image(args.prompt, args.output, args.aspect, args.size, args.ref)


if __name__ == "__main__":
    main()
