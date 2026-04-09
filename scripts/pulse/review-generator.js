'use strict';

const fs = require('fs');
const path = require('path');

const REVIEW_DIR = path.join(__dirname, '../../data/review');

/**
 * Heuristic content angle suggestion based on source type and title keywords.
 * No Claude API calls — pure string matching.
 */
function suggestAngle(idea) {
  const title = (idea.title || '').toLowerCase();
  const type = idea.source_type;

  if (type === 'changelog') return 'News reaction';

  const hotTakeKeywords = ['wrong', 'actually', 'unpopular', 'hot take', 'nobody talks', 'overrated', 'underrated', 'myth', 'stop', 'bad take'];
  if (hotTakeKeywords.some(kw => title.includes(kw))) return 'Hot take';

  const tutorialKeywords = ['tutorial', 'how to', 'guide', 'learn', 'step by step', 'walkthrough', 'explained', 'tips', 'tricks'];
  if (tutorialKeywords.some(kw => title.includes(kw))) return 'Tutorial breakdown';

  const listKeywords = ['top', 'best', 'worst', 'list', 'reasons', 'ways', 'things'];
  if (listKeywords.some(kw => title.includes(kw))) return 'List format post';

  const storyKeywords = ['i built', 'i made', 'i tried', 'my experience', 'case study', 'story', 'journey'];
  if (storyKeywords.some(kw => title.includes(kw))) return 'Personal story';

  return 'Topic breakdown';
}

/**
 * Count ideas by source type.
 */
function countBySource(ideas) {
  const counts = { youtube: 0, tiktok: 0, x: 0, changelog: 0 };
  for (const idea of ideas) {
    if (counts.hasOwnProperty(idea.source_type)) counts[idea.source_type]++;
  }
  return counts;
}

/**
 * Format a score as a fixed 2-decimal string.
 */
function fmtScore(score) {
  return (score || 0).toFixed(2);
}

/**
 * Generate and write the daily review markdown file.
 * @param {Array} ideas - Array of scored idea objects, sorted by score descending
 */
function generateReviewMarkdown(ideas) {
  // Ensure review directory exists
  fs.mkdirSync(REVIEW_DIR, { recursive: true });

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filePath = path.join(REVIEW_DIR, `${today}.md`);

  const counts = countBySource(ideas);

  const lines = [
    `# Daily Content Review -- ${today}`,
    '',
    `**Ideas found:** ${ideas.length}  |  **Sources:** YouTube (${counts.youtube}), TikTok (${counts.tiktok}), X (${counts.x}), Changelog (${counts.changelog})`,
    '',
    '---',
    '',
  ];

  ideas.forEach((idea, idx) => {
    const angle = suggestAngle(idea);
    const transcript = idea.transcript || null;

    lines.push(`## ${idx + 1}. [${fmtScore(idea.score)}] ${idea.title}`);
    lines.push('');
    lines.push(`**Source:** [${idea.source_type}](${idea.source_url || '#'})`);
    lines.push(`**Angle:** ${angle}`);
    lines.push('');
    if (idea.summary) {
      lines.push(`> ${idea.summary.replace(/\n/g, ' ').slice(0, 500)}`);
      lines.push('');
    }
    lines.push('<details>');
    lines.push('<summary>Transcript (expand to skim)</summary>');
    lines.push('');
    if (transcript) {
      lines.push(transcript.slice(0, 5000));
    } else {
      lines.push('No transcript available.');
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`[REVIEW] Review file written: ${filePath}`);
  return filePath;
}

module.exports = { generateReviewMarkdown };
