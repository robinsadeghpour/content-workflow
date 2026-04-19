#!/usr/bin/env node
/**
 * Generate slide images via Gemini API (Nano Banana / Gemini fallback for TikTok/Instagram slides).
 * Used when no real photos are available in the photo catalog.
 *
 * Per D-01: AI image generation uses Gemini via Nano Banana pattern, not OpenAI image models.
 *
 * Usage:
 *   node generate-ai-slides.js --prompts <prompts.json> --output <dir>
 *
 * Arguments:
 *   --prompts  JSON array of image generation prompts (one per slide)
 *   --output   Directory to write generated PNGs (created if it doesn't exist)
 *
 * Output:
 *   slide-01.png, slide-02.png, ... in the output directory
 *   JSON summary printed to stdout on completion
 *
 * Environment:
 *   GEMINI_API_KEY must be set in .env or environment
 *
 * Security:
 *   - GEMINI_API_KEY loaded from .env via dotenv only, never logged or embedded in output
 *   - Gemini API response validated before writing: checks inlineData exists and is base64
 *   - Each request has a 30s timeout via AbortController (T-03-04)
 *   - p-limit(3) bounds concurrent Gemini API calls (T-03-04)
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// p-limit v4 CJS interop: access via .default || direct (v4 wraps default export)
const _pLimit = require('p-limit');
const limit = (_pLimit.default || _pLimit)(3);

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 30000;

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const promptsPath = getArg('prompts');
const outputDir = getArg('output');

if (!promptsPath || !outputDir) {
  console.error('Usage: node generate-ai-slides.js --prompts <prompts.json> --output <dir>');
  process.exit(1);
}

// Validate GEMINI_API_KEY before proceeding (T-03-02)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in .env -- cannot generate AI slides');
  process.exit(1);
}

const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));

if (!Array.isArray(prompts) || prompts.length < 1) {
  console.error('prompts.json must be a non-empty JSON array');
  process.exit(1);
}

// Create output directory if it doesn't exist
fs.mkdirSync(outputDir, { recursive: true });

/**
 * Generate a single slide image via Gemini API.
 * Validates the response structure before writing to disk (T-03-03).
 *
 * @param {string} prompt - Image generation prompt
 * @param {string} outPath - Absolute path to write the output PNG
 * @param {number} slideIndex - 0-based slide index for logging
 */
async function generateSlide(prompt, outPath, slideIndex) {
  const slideNum = String(slideIndex + 1).padStart(2, '0');

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`Gemini API error ${response.status} for slide ${slideNum}: ${errorText}`);
  }

  const result = await response.json();

  // Validate response structure before writing (T-03-03)
  const candidates = result && result.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(`Gemini response missing candidates for slide ${slideNum}`);
  }
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error(`Gemini response missing content parts for slide ${slideNum}`);
  }

  // Find the image part (inlineData with base64 PNG)
  const imagePart = parts.find(p => p.inlineData && p.inlineData.data);
  if (!imagePart) {
    throw new Error(`Gemini response has no inlineData image for slide ${slideNum}`);
  }

  // Validate base64 format before decoding
  const base64Data = imagePart.inlineData.data;
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    throw new Error(`Gemini inlineData is not a valid base64 string for slide ${slideNum}`);
  }

  const imageBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outPath, imageBuffer);
}

(async () => {
  const outputFiles = [];
  const tasks = prompts.map((prompt, i) => {
    const slideNum = String(i + 1).padStart(2, '0');
    const outFilename = `slide-${slideNum}.png`;
    const outPath = path.join(outputDir, outFilename);
    outputFiles.push(outFilename);

    return limit(() => generateSlide(prompt, outPath, i));
  });

  await Promise.all(tasks);

  // JSON summary to stdout for orchestrator consumption
  const summary = {
    slides: prompts.length,
    output_dir: outputDir,
    files: outputFiles
  };
  console.log(JSON.stringify(summary));
})().catch(err => {
  console.error('generate-ai-slides error:', err.message);
  process.exit(1);
});
