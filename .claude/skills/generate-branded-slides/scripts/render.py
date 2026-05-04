#!/usr/bin/env python3
"""Screenshot each .slide element from a slide deck HTML file and produce a PDF.

Usage:
  render.py <html-file> <output-dir>

Outputs:
  <output-dir>/slide-1.png ... slide-N.png  (1080x1350, 2x DPR)
  <output-dir>/<html-stem>.pdf              (combined)
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    if len(sys.argv) < 3:
        print("Usage: render.py <html-file> <output-dir>", file=sys.stderr)
        sys.exit(2)

    html_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()

    if not html_path.exists():
        print(f"Error: {html_path} not found", file=sys.stderr)
        sys.exit(2)

    output_dir.mkdir(parents=True, exist_ok=True)
    url = f"file://{html_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 1400}, device_scale_factor=2)
        page.goto(url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # font settle

        slides = page.query_selector_all(".slide")
        if not slides:
            print("No .slide elements found.", file=sys.stderr)
            browser.close()
            sys.exit(1)

        png_paths = []
        for i, slide in enumerate(slides, 1):
            out = output_dir / f"slide-{i}.png"
            slide.screenshot(path=str(out))
            png_paths.append(out)
            print(f"Saved: {out}")
        browser.close()

    # Combined PDF named after the html stem, written into output_dir
    pdf_path = output_dir / f"{html_path.stem}.pdf"
    try:
        from PIL import Image
        images = [Image.open(p).convert("RGB") for p in png_paths]
        images[0].save(pdf_path, save_all=True, append_images=images[1:], resolution=150)
        print(f"PDF: {pdf_path}")
    except ImportError:
        print("Pillow missing — skipping PDF. Install: ~/.local/pipx/venvs/notebooklm-py/bin/pip install Pillow",
              file=sys.stderr)


if __name__ == "__main__":
    main()
