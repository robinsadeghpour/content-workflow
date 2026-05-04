#!/usr/bin/env python3
"""Capture the GitHub repo header (logo + name + desc + topics + stats) as a PNG.

Used by the repo-screenshot subagent as a fallback when the OG social card
isn't available or isn't desired.

Usage:
  screenshot-github.py --url <repo_url> --output <path.png> [--width 1200] [--timeout 20000]

The captured element is the repo header pagehead — covers the breadcrumb,
description, topics, and the stats/about bar.
"""

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout


VIEWPORT_HEIGHT = 630  # matches GitHub OG card aspect (1200×630)


def capture(url: str, output: Path, width: int, timeout: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": width, "height": VIEWPORT_HEIGHT},
            device_scale_factor=2,
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        except PWTimeout:
            print(f"ERROR: navigation timeout for {url}", file=sys.stderr)
            sys.exit(2)

        # Dismiss the cookie banner if present (GitHub shows it for unauthed visits in EU).
        try:
            page.locator("button", has_text="Accept").first.click(timeout=1500)
        except Exception:
            pass

        # Wait for the repo title to render so we don't capture a half-loaded page.
        try:
            page.locator('strong[itemprop="name"], [data-testid="repository-container-header"]').first.wait_for(
                state="visible", timeout=5000
            )
        except PWTimeout:
            pass  # take what we have

        # Viewport screenshot — captures the top 1200×630 of the page, which is
        # the repo header strip (title + description + topics + stats bar).
        page.screenshot(path=str(output), full_page=False)
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", type=int, default=1200)
    parser.add_argument("--timeout", type=int, default=20000)
    args = parser.parse_args()

    out = Path(args.output).resolve()
    capture(args.url, out, args.width, args.timeout)
    if not out.exists() or out.stat().st_size < 5000:
        print("ERROR: output file missing or too small", file=sys.stderr)
        sys.exit(2)
    print(str(out))


if __name__ == "__main__":
    main()
