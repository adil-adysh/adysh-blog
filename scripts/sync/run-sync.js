/**
 * run-sync.js
 *
 * Core sync orchestrator.
 * No CLI parsing. No process.exit.
 */

const fs = require('fs');
const path = require('path');

const { createHashnodeClient } = require('./hashnode-client');
const { splitFrontmatter } = require('./utils');
const { syncPost } = require('./sync-posts');
const { syncSeriesFolder } = require('./sync-series');

/**
 * Resolve publication ID by content type
 */
function getPublicationId(type, env) {
  if (type === 'tech') return env.TECH_PUBLICATION_ID;
  if (type === 'personal') return env.PERSONAL_PUBLICATION_ID;
  throw new Error(`Unknown content type: ${type}`);
}

/**
 * Sync one root (tech / personal)
 */
async function syncRoot({ rootPath, publicationId, client, env, dryRun = false }) {
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    // -----------------------------
    // Series folder
    // -----------------------------
    if (entry.isDirectory()) {
      await syncSeriesFolder({
        client,
        folderPath: fullPath,
        publicationId,
        syncPost,
        env,
        dryRun,
      });
      continue;
    }

    // -----------------------------
    // Standalone post
    // -----------------------------
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { frontmatter, body } = splitFrontmatter(raw);

      await syncPost({
        client,
        frontmatter,
        body,
        publicationId,
        env,
        dryRun,
      });
    }
  }
}

/**
 * Public API: runSync
 */
async function runSync(options = {}, env = process.env) {
  const token = env.HASHNODE_PAT;
  let client;

  if (!token) {
    if (options.dryRun === true) {
      console.log('⚠️ No HASHNODE_PAT found — running in dry-run mode without live API. Read-only lookups will be simulated as empty.');
      // Stub client: return empty data for any query (simulates "not found")
      client = { gql: async () => ({}) };
    } else {
      throw new Error("HASHNODE_PAT is required — set it as an environment variable.\n\nExamples:\n  PowerShell: $env:HASHNODE_PAT = 'your_token'\n  Bash: export HASHNODE_PAT=your_token\n\nIn CI, set a repo secret named \"HASHNODE_PAT\". For a safe preview, run `npx hashnode-sync --dry-run`.");
    }
  } else {
    client = createHashnodeClient(token);
  }

  const postsRoot = path.resolve(process.cwd(), 'posts');
  if (!fs.existsSync(postsRoot)) {
    throw new Error('posts/ directory not found');
  }

  const targets = [];

  if (options.tech !== false) targets.push('tech');
  if (options.personal !== false) targets.push('personal');

  for (const type of targets) {
    const publicationId = getPublicationId(type, env);
    if (!publicationId) {
      console.log(`⚠️ Skipping ${type} (no publication ID)`);
      continue;
    }

    const rootPath = path.join(postsRoot, type);
    if (!fs.existsSync(rootPath)) {
      console.log(`⚠️ ${rootPath} does not exist`);
      continue;
    }

    console.log(`\n📦 Syncing ${type}`);
    await syncRoot({ rootPath, publicationId, client, env, dryRun: options.dryRun === true });
  }
}

module.exports = {
  runSync,
};
