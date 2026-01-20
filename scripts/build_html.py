#!/usr/bin/env python3
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]

INCLUDE_PATTERN = re.compile(r"<div\s+data-include=\"([^\"]+)\"\s*></div>")


def inline_includes(html):
    while True:
        match = INCLUDE_PATTERN.search(html)
        if not match:
            break
        include_path = ROOT / match.group(1)
        if not include_path.exists():
            raise FileNotFoundError(f"Missing include: {include_path}")
        included_html = include_path.read_text()
        html = html[: match.start()] + included_html + html[match.end() :]
    return html


def main():
    parser = argparse.ArgumentParser(description="Inline HTML partials into a single file.")
    parser.add_argument("--input", default="index.html", help="HTML entry file")
    parser.add_argument("--output", default="dist/index.html", help="Output HTML file")
    args = parser.parse_args()

    input_path = ROOT / args.input
    output_path = ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    html = input_path.read_text()
    html = inline_includes(html)

    output_path.write_text(html)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
