#!/usr/bin/env node
/**
 * Add text overlays to TikTok/Instagram slideshow images using node-canvas.
 * Forked from Larry 1.0.0/scripts/add-text-overlay.js with flexible slide count (2-12).
 *
 * Usage:
 *   node generate-tiktok-slides.js --photos <photos.json> --texts <texts.json> --output <dir> [--overlays <overlays.json>]
 *
 * Arguments:
 *   --photos    JSON array of absolute photo file paths (one per slide)
 *   --texts     JSON array of text strings (one per slide, same length as photos)
 *   --output    Directory to write final PNGs (created if it doesn't exist)
 *   --overlays  (optional) JSON array of absolute image paths for inset overlays (null for no overlay on a slide)
 *
 * Output:
 *   slide-01.png, slide-02.png, ... in the output directory
 *   JSON summary printed to stdout on completion
 *
 * TEXT RULES:
 *   - Use \n for manual line breaks (PREFERRED — gives you control)
 *   - If no \n provided, the script auto-wraps to fit within maxWidth
 *   - Keep lines to 4-6 words max for readability
 *   - Text is REACTIONS not labels ("Wait... this is nice??" not "Modern style")
 *   - No emoji (canvas can't render them)
 */
'use strict';

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const photosPath = getArg('photos');
const textsPath = getArg('texts');
const outputDir = getArg('output');
const overlaysPath = getArg('overlays');

if (!photosPath || !textsPath || !outputDir) {
  console.error('Usage: node generate-tiktok-slides.js --photos <photos.json> --texts <texts.json> --output <dir> [--overlays <overlays.json>]');
  process.exit(1);
}

const photos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
const texts = JSON.parse(fs.readFileSync(textsPath, 'utf-8'));
const overlays = overlaysPath ? JSON.parse(fs.readFileSync(overlaysPath, 'utf-8')) : null;

// Flexible slide count: 2-12 slides supported (replaces Larry's hardcoded 6-slide check)
if (texts.length < 2 || texts.length > 12) {
  console.error('Slide count must be 2-12, got ' + texts.length);
  process.exit(1);
}
if (texts.length !== photos.length) {
  console.error('texts and photos arrays must be same length');
  process.exit(1);
}
if (overlays && overlays.length !== texts.length) {
  console.error('overlays array must be same length as texts/photos');
  process.exit(1);
}

// Create output directory if it doesn't exist
fs.mkdirSync(outputDir, { recursive: true });

/**
 * Word-wrap text to fit within maxWidth.
 * If the text already contains \n, splits on those first,
 * then wraps any lines that are still too wide.
 * Strips emoji since canvas can't render them reliably.
 */
function wrapText(ctx, text, maxWidth) {
  // Strip emoji (canvas can't render them reliably)
  const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

  // Split on manual line breaks first
  const manualLines = cleanText.split('\n');
  const wrappedLines = [];

  for (const line of manualLines) {
    // Check if this line fits as-is
    if (ctx.measureText(line.trim()).width <= maxWidth) {
      wrappedLines.push(line.trim());
      continue;
    }

    // Auto-wrap: split into words, build lines that fit
    const words = line.trim().split(/\s+/);
    const autoLines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) autoLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) autoLines.push(currentLine);

    // Orphan rebalance: if the last line is a single word and the previous
    // line has 3+ words, move one word down so the orphan joins a partner.
    // Only applies when the rebalanced pair still fits maxWidth.
    if (autoLines.length >= 2) {
      const last = autoLines[autoLines.length - 1];
      const prev = autoLines[autoLines.length - 2];
      const prevWords = prev.split(/\s+/);
      if (!last.includes(' ') && prevWords.length >= 3) {
        const moved = prevWords.pop();
        const newPrev = prevWords.join(' ');
        const newLast = `${moved} ${last}`;
        if (
          ctx.measureText(newPrev).width <= maxWidth &&
          ctx.measureText(newLast).width <= maxWidth
        ) {
          autoLines[autoLines.length - 2] = newPrev;
          autoLines[autoLines.length - 1] = newLast;
        }
      }
    }

    wrappedLines.push(...autoLines);
  }

  return wrappedLines;
}

async function addTextOverlay(imgPath, text, outPath, overlayPath) {
  const img = await loadImage(imgPath);

  // Fixed 1080x1920 canvas with cover-fit background
  const canvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Cover-fit: scale image to fill canvas, center and crop excess
  const scale = Math.max(OUTPUT_WIDTH / img.width, OUTPUT_HEIGHT / img.height);
  const scaledW = img.width * scale;
  const scaledH = img.height * scale;
  const dx = (OUTPUT_WIDTH - scaledW) / 2;
  const dy = (OUTPUT_HEIGHT - scaledH) / 2;
  ctx.drawImage(img, dx, dy, scaledW, scaledH);

  // Overlay inset image (screenshot, chart, etc.) — drawn before text
  if (overlayPath) {
    const overlay = await loadImage(overlayPath);
    // Overlay sizing: 60% width is the readability sweet spot for CLI screenshots and
    // UI mockups — smaller and text inside is illegible, larger and it crowds the hook.
    // Positioned so overlay center sits at 68% from top — above TikTok's bottom 20%
    // caption/UI safe zone, below the 30%-anchored text block, with breathing room.
    const overlayMaxW = OUTPUT_WIDTH * 0.75;
    const overlayScale = overlayMaxW / overlay.width;
    const ow = overlay.width * overlayScale;
    const oh = overlay.height * overlayScale;
    const ox = (OUTPUT_WIDTH - ow) / 2;
    const oy = (OUTPUT_HEIGHT * 0.68) - (oh / 2);

    // Drop shadow behind overlay
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;

    // White border frame
    const border = 3;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ox - border, oy - border, ow + border * 2, oh + border * 2);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.drawImage(overlay, ox, oy, ow, oh);
  }

  // Text settings — match proven viral format
  const fontSize = Math.round(OUTPUT_WIDTH * 0.065);    // ~70px on 1080w
  const outlineWidth = Math.round(fontSize * 0.15);
  const maxWidth = OUTPUT_WIDTH * 0.75;
  const lineHeight = fontSize * 1.25;

  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Wrap text to fit within maxWidth
  const lines = wrapText(ctx, text, maxWidth);

  // Calculate vertical position — center text block at 30% from top
  const totalTextHeight = lines.length * lineHeight;
  const startY = (OUTPUT_HEIGHT * 0.30) - (totalTextHeight / 2) + (lineHeight / 2);

  // Ensure text stays in safe zones (not top 10%, not bottom 20%)
  const minY = OUTPUT_HEIGHT * 0.10;
  const maxY = OUTPUT_HEIGHT * 0.80 - totalTextHeight;
  const safeY = Math.max(minY, Math.min(startY, maxY));

  const x = OUTPUT_WIDTH / 2;

  // Text shadow for extra separation
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  for (let i = 0; i < lines.length; i++) {
    const y = safeY + (i * lineHeight);

    // Black outline (stroke first, then fill on top)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(lines[i], x, y);

    // White fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[i], x, y);
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
}

(async () => {
  const outputFiles = [];

  for (let i = 0; i < texts.length; i++) {
    const slideNum = String(i + 1).padStart(2, '0');
    const outFilename = `slide-${slideNum}.png`;
    const outPath = path.join(outputDir, outFilename);

    const overlayImg = overlays ? overlays[i] : null;
    await addTextOverlay(photos[i], texts[i], outPath, overlayImg);
    outputFiles.push(outFilename);
  }

  // JSON summary to stdout for orchestrator consumption
  const summary = {
    slides: texts.length,
    output_dir: outputDir,
    files: outputFiles
  };
  console.log(JSON.stringify(summary));
})().catch(err => {
  console.error('generate-tiktok-slides error:', err.message);
  process.exit(1);
});
