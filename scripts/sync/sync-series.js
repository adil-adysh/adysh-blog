/**
 * sync-series.js
 *
 * Series-level sync logic.
 * - Create or update series metadata
 * - Append posts to series in deterministic order
 * - No reordering
 * - No removals
 */

const fs = require('fs');
const path = require('path');
const { splitFrontmatter, validateFrontmatter } = require('./utils');

/**
 * Ensure series exists (create or update by slug)
 */
async function ensureSeries(client, seriesFrontmatter, publicationId, env = process.env) {
  validateFrontmatter(seriesFrontmatter, ['name', 'slug']);

  const query = `
    query ($slug: String!) {
      series(slug: $slug) {
        id
      }
    }
  `;

  let existingId = null;
  try {
    const data = await client.gql(query, { slug: seriesFrontmatter.slug });
    existingId = data?.series?.id ?? null;
  } catch {
    existingId = null;
  }

  const baseInput = {
    name: seriesFrontmatter.name,
    slug: seriesFrontmatter.slug,
    publicationId,
    descriptionMarkdown: seriesFrontmatter.descriptionMarkdown,
    sortOrder: seriesFrontmatter.sortOrder ?? 'asc',
  };

  if (seriesFrontmatter.coverImage) {
    const { assetPathToRawUrl } = require('./utils');
    baseInput.coverImage = assetPathToRawUrl(seriesFrontmatter.coverImage, env);
  }

  if (existingId) {
    const mutation = `
      mutation ($input: UpdateSeriesInput!) {
        updateSeries(input: $input) {
          series { id }
        }
      }
    `;

    const data = await client.gql(mutation, {
      input: { id: existingId, ...baseInput },
    });

    return data.updateSeries.series.id;
  }

  const mutation = `
    mutation ($input: CreateSeriesInput!) {
      createSeries(input: $input) {
        series { id }
      }
    }
  `;

  const data = await client.gql(mutation, {
    input: baseInput,
  });

  return data.createSeries.series.id;
}

/**
 * Attach a post to a series (append-only)
 */
async function addPostToSeries(client, postId, seriesId) {
  const mutation = `
    mutation ($input: AddPostToSeriesInput!) {
      addPostToSeries(input: $input) {
        series { id }
      }
    }
  `;

  await client.gql(mutation, {
    input: { postId, seriesId },
  });
}

/**
 * Sync all posts inside a series folder
 */
async function syncSeriesFolder({
  client,
  folderPath,
  publicationId,
  syncPost,
  env = process.env,
}) {
  const seriesFile = path.join(folderPath, '_series.md');

  if (!fs.existsSync(seriesFile)) {
    throw new Error(`_series.md not found in ${folderPath}`);
  }

  const rawSeries = fs.readFileSync(seriesFile, 'utf8');
  const { frontmatter: seriesFrontmatter } = splitFrontmatter(rawSeries);

  const seriesId = await ensureSeries(
    client,
    seriesFrontmatter,
    publicationId,
    env
  );

  const postFiles = fs
    .readdirSync(folderPath)
    .filter(f => f.endsWith('.md') && f !== '_series.md')
    .sort();

  for (const file of postFiles) {
    const raw = fs.readFileSync(path.join(folderPath, file), 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);

    const post = await syncPost({
      client,
      frontmatter,
      body,
      publicationId,
      env,
    });

    await addPostToSeries(client, post.id, seriesId);
  }
}

module.exports = {
  ensureSeries,
  addPostToSeries,
  syncSeriesFolder,
};
