/**
 * utils.js
 *
 * Pure helper utilities for sync pipeline.
 * No I/O side effects except string parsing.
 */

const path = require('path');
const yaml = require('yaml');

function toPosixPath(p) {
  return String(p).replace(/\\/g, '/');
}

function isExternalUrl(url) {
  if (!url) return false;
  return /^(https?:\/\/|data:|mailto:)/i.test(String(url).trim());
}

function encodeGitHubRawUrl(url) {
  // encodeURI keeps '/' intact but encodes spaces and other unsafe chars.
  return encodeURI(url);
}

function resolveRepoRelativePathFromAssetRef(assetRef, sourcePath, repoRoot) {
  if (!assetRef) return null;

  const raw = String(assetRef).trim();
  if (!raw) return null;

  // Absolute URL or special schemes are left as-is by callers.
  if (isExternalUrl(raw)) return null;

  if (!sourcePath) {
    // Without context, treat as already repo-relative.
    return toPosixPath(raw).replace(/^\/+/, '');
  }

  const root = repoRoot || process.cwd();
  const absSource = path.resolve(root, sourcePath);
  const absAsset = path.resolve(path.dirname(absSource), raw);

  const rel = path.relative(root, absAsset);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Asset path resolves outside repo root: ${assetRef}`);
  }

  return toPosixPath(rel).replace(/^\/+/, '');
}

function assetRefToRawUrl(assetRef, { env = process.env, dryRun = false, sourcePath, repoRoot } = {}) {
  if (!assetRef) return null;

  const raw = String(assetRef).trim();
  if (!raw) return null;

  if (isExternalUrl(raw)) return raw;

  const repoRelativePath = resolveRepoRelativePathFromAssetRef(raw, sourcePath, repoRoot);
  return assetPathToRawUrl(repoRelativePath, env, dryRun);
}

function splitMarkdownLinkDestination(dest) {
  const trimmed = String(dest || '').trim();
  if (!trimmed) return { url: '', title: '' };

  // <...> form
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return { url: trimmed.slice(1, -1).trim(), title: '' };
  }

  // Optional title at end:  <url> "title"  OR  <url> 'title'
  const m = trimmed.match(/^(.*?)(\s+("[^"]*"|'[^']*'))\s*$/);
  if (m) {
    return { url: m[1].trim(), title: m[2].trim() };
  }

  return { url: trimmed, title: '' };
}

function rewriteMarkdownAssetUrls(markdown, { env = process.env, dryRun = false, sourcePath, repoRoot } = {}) {
  if (!markdown) return markdown;

  // Markdown image syntax: ![alt](dest "optional title")
  const rewritten = String(markdown).replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, (full, alt, dest) => {
    const { url, title } = splitMarkdownLinkDestination(dest);

    if (!url || isExternalUrl(url) || url.startsWith('#')) {
      return full;
    }

    const rawUrl = assetRefToRawUrl(url, { env, dryRun, sourcePath, repoRoot });
    const safeUrl = encodeGitHubRawUrl(rawUrl);
    return `![${alt}](${safeUrl}${title ? ` ${title}` : ''})`;
  });

  // Basic HTML <img src="..."> support
  return rewritten.replace(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*>/gi, (full, src) => {
    const raw = String(src).trim();
    if (!raw || isExternalUrl(raw) || raw.startsWith('#')) return full;
    const rawUrl = assetRefToRawUrl(raw, { env, dryRun, sourcePath, repoRoot });
    const safeUrl = encodeGitHubRawUrl(rawUrl);
    return full.replace(src, safeUrl);
  });
}

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
 * @param {boolean} dryRun - if true, use placeholder URLs when env vars missing
 */
function assetPathToRawUrl(assetPath, env = process.env, dryRun = false) {
  if (!assetPath) return null;

  const repo = env.GITHUB_REPOSITORY;
  const sha = env.GITHUB_SHA;

  if (!repo || !sha) {
    if (dryRun) {
      return `https://raw.githubusercontent.com/[REPO]/[SHA]/${assetPath}`;
    }
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
function resolveCoverImage(frontmatter, env, dryRun = false, sourcePath) {
  const cover = frontmatter.cover || frontmatter.coverImage;
  if (!cover) return null;

  return {
    coverImageURL: assetRefToRawUrl(cover, { env, dryRun, sourcePath }),
  };
}

module.exports = {
  splitFrontmatter,
  validateFrontmatter,
  assetPathToRawUrl,
  assetRefToRawUrl,
  normalizeTags,
  resolveCoverImage,
  rewriteMarkdownAssetUrls,
};
