#!/usr/bin/env node
/**
 * Render a synthetic CLI terminal image for use as an inset overlay on TikTok slides.
 *
 * Usage:
 *   node render-cli-overlay.js --spec <spec.json> --output <out.png>
 *
 * Spec format:
 *   {
 *     "title": "claude code",              // window title (optional)
 *     "lines": [                           // ordered lines in terminal
 *       { "kind": "prompt", "text": "ultrathink" },     // green $ prompt + command
 *       { "kind": "output", "text": "thinking..." },    // plain output
 *       { "kind": "dim",    "text": "(15x budget)" },   // dim/muted output
 *       { "kind": "accent", "text": "✓ done" }          // green accent
 *     ]
 *   }
 *
 * Output: a 1000x560 PNG with a dark terminal look, rounded corners, soft border.
 *
 * Sizing rationale:
 *   The TikTok slide renderer places overlays at ~50% of the 1080px canvas width
 *   (~540px after scaling). We render at 1000px wide so the downscale lands at
 *   roughly 1.85x → crisp text even at small size. Line height is large so output
 *   stays readable when the image sits in the lower half of a 1080x1920 slide.
 */
'use strict';

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(n) { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : null; }

const specPath = getArg('spec');
const outPath = getArg('output');
if (!specPath || !outPath) {
  console.error('Usage: render-cli-overlay.js --spec <spec.json> --output <out.png>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

// Sized for scroll-distance readability after the slide renderer scales the overlay
// to 75% of the 1080px canvas. Font and padding chosen so CLI text lands at roughly
// 2.5% of final canvas height — readable at a thumb flick, not crowding the hook.
const WIDTH = 1000;
const PADDING = 56;
const TITLE_BAR_H = 64;
const FONT_SIZE = 48;
const LINE_HEIGHT = 72;
const TITLE_FONT_SIZE = 30;

const lineCount = (spec.lines || []).length;
const HEIGHT = TITLE_BAR_H + PADDING + (lineCount * LINE_HEIGHT) + PADDING - 12;

const COLORS = {
  bg: '#0f1117',
  titleBar: '#1b1e27',
  titleText: '#8a8f99',
  prompt: '#61d07a',
  cmd: '#ffffff',
  output: '#c8ccd4',
  dim: '#6b7280',
  accent: '#61d07a',
  warn: '#eab308',
  err: '#ef4444',
  dot1: '#ff5f56',
  dot2: '#ffbd2e',
  dot3: '#27c93f',
  border: 'rgba(255,255,255,0.06)'
};

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Body (rounded window)
ctx.fillStyle = COLORS.bg;
roundRect(ctx, 0, 0, WIDTH, HEIGHT, 18);
ctx.fill();

// Title bar
ctx.fillStyle = COLORS.titleBar;
ctx.beginPath();
ctx.moveTo(18, 0);
ctx.lineTo(WIDTH - 18, 0);
ctx.quadraticCurveTo(WIDTH, 0, WIDTH, 18);
ctx.lineTo(WIDTH, TITLE_BAR_H);
ctx.lineTo(0, TITLE_BAR_H);
ctx.lineTo(0, 18);
ctx.quadraticCurveTo(0, 0, 18, 0);
ctx.closePath();
ctx.fill();

// Traffic light dots
const dotY = TITLE_BAR_H / 2;
[[28, COLORS.dot1], [54, COLORS.dot2], [80, COLORS.dot3]].forEach(([x, color]) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, dotY, 8, 0, Math.PI * 2);
  ctx.fill();
});

// Title text (optional)
if (spec.title) {
  ctx.fillStyle = COLORS.titleText;
  ctx.font = `500 ${TITLE_FONT_SIZE}px Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.title, WIDTH / 2, dotY);
}

// Terminal lines
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.font = `500 ${FONT_SIZE}px Menlo, monospace`;

let y = TITLE_BAR_H + PADDING - 8;
for (const line of spec.lines || []) {
  let x = PADDING;
  if (line.kind === 'prompt') {
    ctx.fillStyle = COLORS.prompt;
    ctx.fillText('$ ', x, y);
    x += ctx.measureText('$ ').width;
    ctx.fillStyle = COLORS.cmd;
    ctx.fillText(line.text || '', x, y);
  } else if (line.kind === 'dim') {
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(line.text || '', x, y);
  } else if (line.kind === 'accent') {
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(line.text || '', x, y);
  } else if (line.kind === 'warn') {
    ctx.fillStyle = COLORS.warn;
    ctx.fillText(line.text || '', x, y);
  } else if (line.kind === 'err') {
    ctx.fillStyle = COLORS.err;
    ctx.fillText(line.text || '', x, y);
  } else {
    ctx.fillStyle = COLORS.output;
    ctx.fillText(line.text || '', x, y);
  }
  y += LINE_HEIGHT;
}

// Soft inner border
ctx.strokeStyle = COLORS.border;
ctx.lineWidth = 2;
roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 17);
ctx.stroke();

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
console.log(JSON.stringify({ output: outPath, width: WIDTH, height: HEIGHT }));
