/**
 * utils.js
 *
 * Pure helper utilities for sync pipeline.
 * No I/O side effects except string parsing.
 */

const path = require('path');
const yaml = require('yaml');

/**
 * Split YAML frontmatter from markdown body
 *
 * @param {string} raw
 * @returns {{ frontmatter: object, body: string }}
 */
function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    throw new Error('Frontmatter must start with ---');
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);

  if (!match) {
    throw new Error('Invalid frontmatter format');
  }

  const frontmatter = yaml.parse(match[1]);

  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error('Frontmatter is not a valid YAML object');
  }

  const body = match[2] || '';

  return {
    frontmatter,
    body: body.trim(),
  };
}

/**
 * Validate required frontmatter keys
 *
 * @param {object} fm
 * @param {string[]} required
 * @param {string} context
 */
function validateFrontmatter(fm, required, context = '') {
  for (const key of required) {
    if (!fm[key]) {
      throw new Error(
        `Missing required frontmatter key '${key}'${context ? ` in ${context}` : ''}`
      );
    }
  }
}

/**
 * Convert local asset path to GitHub raw URL
 *
 * @param {string} assetPath
 * @param {object} env
 */
function assetPathToRawUrl(assetPath, env = process.env) {
  if (!assetPath) return null;

  const repo = env.GITHUB_REPOSITORY;
  const sha = env.GITHUB_SHA;

  if (!repo || !sha) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');
  }

  return `https://raw.githubusercontent.com/${repo}/${sha}/${assetPath}`;
}

/**
 * Normalize frontmatter tags to Hashnode format
 *
 * @param {string[]} tags
 */
function normalizeTags(tags) {
  if (!tags) return [];

  if (!Array.isArray(tags)) {
    throw new Error('tags must be an array');
  }

  return tags.map(tag => {
    if (typeof tag !== 'string') {
      throw new Error('tag values must be strings');
    }
    return { name: tag };
  });
}

/**
 * Resolve cover image from frontmatter
 *
 * Supports:
 * - cover
 * - coverImage
 */
function resolveCoverImage(frontmatter, env) {
  const cover = frontmatter.cover || frontmatter.coverImage;
  if (!cover) return null;

  return {
    coverImageURL: assetPathToRawUrl(cover, env),
  };
}

module.exports = {
  splitFrontmatter,
  validateFrontmatter,
  assetPathToRawUrl,
  normalizeTags,
  resolveCoverImage,
};
