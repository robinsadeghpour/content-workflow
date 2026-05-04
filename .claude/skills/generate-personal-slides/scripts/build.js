#!/usr/bin/env node
/**
 * generate-personal-slides — orchestrator.
 *
 * Reads a slide spec, resolves photos against the catalog, validates any
 * overlay image paths, calls the project's TikTok slide compositor, and (for
 * Instagram) sharp-crops the 1080x1920 outputs to 1080x1350.
 *
 * Overlays are real images only (screenshots, repo cards, charts, product UI).
 * Synthesized fake terminal overlays are NOT supported — pass an absolute path.
 *
 * Usage:
 *   node build.js <spec.json> --output <dir> [--filename <stem>]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const CATALOG_PATH = path.join(PROJECT_ROOT, 'media/images/tiktok/catalog.json');
const PHOTO_DIR = path.join(PROJECT_ROOT, 'media/images/tiktok');
const TIKTOK_RENDERER = path.join(PROJECT_ROOT, 'scripts/generate-tiktok-slides.js');

function getArg(args, name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function scorePhoto(photo, keywords) {
  const haystack = tokenize(
    [photo.description, photo.mood, ...(photo.best_for || []), photo.category].join(' ')
  );
  const needles = keywords.flatMap(tokenize);
  if (needles.length === 0) return 0;
  let hits = 0;
  for (const n of needles) {
    if (haystack.includes(n)) hits++;
  }
  return hits / needles.length;
}

function resolvePhoto(slide, catalog, usedIds) {
  if (slide.photo && slide.photo !== 'auto') {
    if (!path.isAbsolute(slide.photo)) {
      throw new Error(`photo path must be absolute: ${slide.photo}`);
    }
    return slide.photo;
  }
  const keywords = slide.photo_keywords || [];
  const ranked = catalog.photos
    .map((p) => ({ p, score: scorePhoto(p, keywords), penalty: usedIds.has(p.id) ? 1 : 0 }))
    .sort((a, b) => b.score - a.score || a.penalty - b.penalty);
  const pick = ranked[0]?.p || catalog.photos[0];
  usedIds.add(pick.id);
  return path.join(PHOTO_DIR, pick.filename);
}

function resolveOverlay(spec, _tmpDir, idx) {
  if (!spec || typeof spec !== 'object' || !spec.image) {
    throw new Error(`slide ${idx}: overlay must be { image: "/abs/path.png" } — synthesized CLI overlays are not supported`);
  }
  if (!path.isAbsolute(spec.image)) throw new Error(`overlay.image must be absolute: ${spec.image}`);
  if (!fs.existsSync(spec.image)) throw new Error(`overlay.image not found: ${spec.image}`);
  return spec.image;
}

async function cropToInstagram(dir) {
  const sharp = require(path.join(PROJECT_ROOT, 'node_modules/sharp'));
  const files = fs.readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
  for (const f of files) {
    const src = path.join(dir, f);
    const buf = await sharp(src).resize(1080, 1350, { fit: 'cover', position: 'centre' }).toBuffer();
    fs.writeFileSync(src, buf);
  }
  return files.length;
}

async function main() {
  const args = process.argv.slice(2);
  const specPath = args[0];
  if (!specPath || specPath.startsWith('--')) {
    console.error('usage: build.js <spec.json> --output <dir> [--filename <stem>]');
    process.exit(2);
  }
  const outputDir = getArg(args, 'output') || process.cwd();
  const filenameOverride = getArg(args, 'filename');

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const platform = spec.platform;
  if (!['tiktok', 'instagram'].includes(platform)) {
    throw new Error(`platform must be "tiktok" or "instagram", got: ${platform}`);
  }
  const slides = spec.slides || [];
  if (slides.length < 2 || slides.length > 12) {
    throw new Error(`slide count must be 2-12, got ${slides.length}`);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const tmpDir = path.join(os.tmpdir(), `gps-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    const usedIds = new Set();
    const photos = slides.map((s) => resolvePhoto(s, catalog, usedIds));
    const texts = slides.map((s) => {
      if (typeof s.text !== 'string') throw new Error('each slide needs a "text" string');
      return s.text;
    });
    const overlays = slides.map((s, i) => (s.overlay ? resolveOverlay(s.overlay, tmpDir, i + 1) : null));

    const photosPath = path.join(tmpDir, 'photos.json');
    const textsPath = path.join(tmpDir, 'texts.json');
    const overlaysPath = path.join(tmpDir, 'overlays.json');
    fs.writeFileSync(photosPath, JSON.stringify(photos));
    fs.writeFileSync(textsPath, JSON.stringify(texts));
    fs.writeFileSync(overlaysPath, JSON.stringify(overlays));

    const r = spawnSync(
      'node',
      [
        TIKTOK_RENDERER,
        '--photos', photosPath,
        '--texts', textsPath,
        '--overlays', overlaysPath,
        '--output', outputDir,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'], cwd: PROJECT_ROOT }
    );
    if (r.status !== 0) throw new Error('tiktok renderer failed');

    let format = '1080x1920';
    if (platform === 'instagram') {
      await cropToInstagram(outputDir);
      format = '1080x1350';
    }

    console.log(JSON.stringify({
      slides: slides.length,
      format,
      platform,
      filename: filenameOverride || spec.filename || null,
      output_dir: outputDir,
      photos_used: photos.map((p) => path.basename(p)),
    }, null, 2));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`build.js error: ${e.message}`);
  process.exit(1);
});
