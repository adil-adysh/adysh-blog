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
 * Returns { seriesId, existingPostIds }
 */
async function ensureSeries(client, seriesFrontmatter, publicationId, env = process.env, dryRun = false) {
  validateFrontmatter(seriesFrontmatter, ['name', 'slug']);

  const query = `
    query ($slug: String!) {
      series(slug: $slug) {
        id
        posts(first: 50) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;

  let existingId = null;
  let existingPostIds = [];
  
  if (!dryRun) {
    try {
      const data = await client.gql(query, { slug: seriesFrontmatter.slug });
      existingId = data?.series?.id ?? null;
      if (data?.series?.posts?.edges) {
        existingPostIds = data.series.posts.edges.map(edge => edge.node.id);
      }
    } catch {
      existingId = null;
      existingPostIds = [];
    }
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
    baseInput.coverImage = assetPathToRawUrl(seriesFrontmatter.coverImage, env, dryRun);
  }

  if (existingId) {
    if (dryRun) {
      console.log(`📚 DRY-RUN: updateSeries ${seriesFrontmatter.slug}`);
      return { seriesId: 'dry-run-series', existingPostIds: [] };
    }

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

    return { seriesId: data.updateSeries.series.id, existingPostIds };
  }

  const mutation = `
    mutation ($input: CreateSeriesInput!) {
      createSeries(input: $input) {
        series { id }
      }
    }
  `;

  if (dryRun) {
    console.log(`📚 DRY-RUN: createSeries ${seriesFrontmatter.slug}`);
    return { seriesId: 'dry-run-series', existingPostIds: [] };
  }

  const data = await client.gql(mutation, {
    input: baseInput,
  });

  return { seriesId: data.createSeries.series.id, existingPostIds: [] };
}

/**
 * Attach a post to a series (append-only)
 */
async function addPostToSeries(client, postId, seriesId, dryRun = false) {
  const mutation = `
    mutation ($input: AddPostToSeriesInput!) {
      addPostToSeries(input: $input) {
        series { id }
      }
    }
  `;

  if (dryRun) {
    console.log(`   ↳ DRY-RUN: addPostToSeries`, { postId, seriesId });
    return;
  }

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
  dryRun = false,
  env = process.env,
}) {
  const seriesFile = path.join(folderPath, '_series.md');

  if (!fs.existsSync(seriesFile)) {
    throw new Error(`_series.md not found in ${folderPath}`);
  }

  const rawSeries = fs.readFileSync(seriesFile, 'utf8');
  const { frontmatter: seriesFrontmatter } = splitFrontmatter(rawSeries);

  const { seriesId, existingPostIds } = await ensureSeries(
    client,
    seriesFrontmatter,
    publicationId,
    env,
    dryRun
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
      dryRun,
    });

    // Only add post if it's not already in the series
    if (!existingPostIds.includes(post.id)) {
      await addPostToSeries(client, post.id, seriesId, dryRun);
    } else if (!dryRun) {
      console.log(`   ↳ Post already in series, skipping`);
    }
  }
}

module.exports = {
  ensureSeries,
  addPostToSeries,
  syncSeriesFolder,
};
