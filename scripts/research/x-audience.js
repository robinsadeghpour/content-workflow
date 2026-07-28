#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  runActorDatasetItems,
  sanitizeLogText,
  splitActorRows,
  warnDiagnostics,
} = require('../lib/apify');

const PROJECT_ROOT = path.join(__dirname, '../..');
const RESEARCH_ROOT = path.join(PROJECT_ROOT, 'data', 'research');
const FOLLOWER_ACTOR = 'xquik/x-follower-scraper';
const TARGET_KEYS = ['twitterHandles', 'userIds', 'listIds', 'communityIds'];
const RELATION_TARGETS = {
  followers: {
    keys: ['twitterHandles', 'userIds'],
    requirement: 'an X handle or user ID',
  },
  following: {
    keys: ['twitterHandles', 'userIds'],
    requirement: 'an X handle or user ID',
  },
  verified_followers: {
    keys: ['twitterHandles', 'userIds'],
    requirement: 'an X handle or user ID',
  },
  list_members: {
    keys: ['listIds'],
    requirement: 'an X list ID',
  },
  list_followers: {
    keys: ['listIds'],
    requirement: 'an X list ID',
  },
  community_members: {
    keys: ['communityIds'],
    requirement: 'an X community ID',
  },
};
const OUTPUT_MODES = new Set(['compact', 'full', 'raw']);
const CSV_OPTION_KEYS = {
  '--handles': 'twitterHandles',
  '--user-ids': 'userIds',
  '--list-ids': 'listIds',
  '--community-ids': 'communityIds',
};
const STRING_OPTION_KEYS = {
  '--relation': 'relation',
  '--output-mode': 'outputMode',
  '--output': 'output',
};

const HELP_TEXT = `Usage:
  node scripts/research/x-audience.js [handles...] [options]

Options:
  --handles <a,b>         X handles for profile relations
  --user-ids <1,2>        Numeric X user IDs for profile relations
  --list-ids <1,2>        X list IDs for list relations
  --community-ids <1,2>   X community IDs for community members
  --relation <name>       Relation to collect (default: followers)
  --max-items <count>     Maximum rows across the run (default: 100)
  --output-mode <mode>    compact, full, or raw (default: compact)
  --overlap               Merge duplicates and add overlap metadata
  --output <path>         JSON path under data/research/
  --help                  Show this help

Actor: https://apify.com/xquik/x-follower-scraper
`;

function readOptionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseCsv(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeHandle(handle) {
  const normalized = handle.replace(/^@/, '').toLowerCase();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error(`Invalid X handle: ${handle}`);
  }
  return normalized;
}

function normalizeIds(values, label) {
  return values.map(value => {
    if (!/^\d+$/.test(value)) {
      throw new Error(`Invalid ${label}: ${value}`);
    }
    return value;
  });
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    twitterHandles: [],
    userIds: [],
    listIds: [],
    communityIds: [],
    relation: 'followers',
    maxItems: 100,
    outputMode: 'compact',
    overlap: false,
    output: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      options.help = true;
    } else if (argument === '--overlap') {
      options.overlap = true;
    } else if (Object.hasOwn(CSV_OPTION_KEYS, argument)) {
      const value = readOptionValue(argv, index, argument);
      options[CSV_OPTION_KEYS[argument]].push(...parseCsv(value));
      index += 1;
    } else if (Object.hasOwn(STRING_OPTION_KEYS, argument)) {
      const value = readOptionValue(argv, index, argument);
      options[STRING_OPTION_KEYS[argument]] = value;
      index += 1;
    } else if (argument === '--max-items') {
      const value = readOptionValue(argv, index, argument);
      options.maxItems = parsePositiveInteger(value, argument);
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.twitterHandles.push(argument);
    }
  }

  options.twitterHandles = [...new Set(options.twitterHandles.map(normalizeHandle))];
  options.userIds = [...new Set(normalizeIds(options.userIds, 'X user ID'))];
  options.listIds = [...new Set(normalizeIds(options.listIds, 'X list ID'))];
  options.communityIds = [
    ...new Set(normalizeIds(options.communityIds, 'X community ID')),
  ];

  if (!Object.hasOwn(RELATION_TARGETS, options.relation)) {
    throw new Error(`Unsupported relation: ${options.relation}`);
  }
  if (!OUTPUT_MODES.has(options.outputMode)) {
    throw new Error(`Unsupported output mode: ${options.outputMode}`);
  }

  return options;
}

function buildAudienceInput(options) {
  const targetConfig = RELATION_TARGETS[options.relation];
  if (!targetConfig) {
    throw new Error(`Unsupported relation: ${options.relation}`);
  }

  const selectedKeys = targetConfig.keys.filter(
    key => options[key].length > 0
  );
  if (selectedKeys.length === 0) {
    throw new Error(
      `${options.relation} requires ${targetConfig.requirement}.`
    );
  }

  const invalidKeys = TARGET_KEYS.filter(
    key => !targetConfig.keys.includes(key) && options[key].length > 0
  );
  if (invalidKeys.length > 0) {
    throw new Error(
      `${options.relation} does not accept ${invalidKeys.join(', ')} targets.`
    );
  }

  const input = {
    relation: options.relation,
    maxItems: options.maxItems,
    outputMode: options.outputMode,
    includeTargetMetadata: true,
  };

  for (const key of selectedKeys) {
    input[key] = options[key];
  }

  if (options.overlap) {
    input.overlapMode = true;
    input.dedupeMode = 'merge';
  }

  return input;
}

function resolveOutputPath(requestedPath, timestamp = Date.now()) {
  const relativePath =
    requestedPath || `data/research/x-audience-${timestamp}.json`;
  const outputPath = path.resolve(PROJECT_ROOT, relativePath);
  const allowedPrefix = `${path.resolve(RESEARCH_ROOT)}${path.sep}`;

  if (!outputPath.startsWith(allowedPrefix) || path.extname(outputPath) !== '.json') {
    throw new Error('Output must be a JSON file under data/research/.');
  }

  return outputPath;
}

async function runAudienceResearch({
  options,
  runActor = runActorDatasetItems,
  warn = console.warn,
  timestamp = Date.now(),
}) {
  const input = buildAudienceInput(options);
  const items = await runActor({
    actorId: FOLLOWER_ACTOR,
    input,
    maxItems: input.maxItems,
  });
  const { dataRows, diagnostics } = splitActorRows(items);
  warnDiagnostics('X Follower Scraper', diagnostics, warn);

  return {
    outputPath: resolveOutputPath(options.output, timestamp),
    report: {
      actor: FOLLOWER_ACTOR,
      collectedAt: new Date(timestamp).toISOString(),
      input,
      profiles: dataRows,
      diagnostics,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const { outputPath, report } = await runAudienceResearch({ options });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  process.stdout.write(
    `Saved ${report.profiles.length} profiles to ${path.relative(PROJECT_ROOT, outputPath)}\n`
  );
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
  main().catch(error => {
    process.stderr.write(
      `Audience research failed. ${sanitizeLogText(error.message)}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = {
  FOLLOWER_ACTOR,
  HELP_TEXT,
  buildAudienceInput,
  main,
  parseArgs,
  resolveOutputPath,
  runAudienceResearch,
};
