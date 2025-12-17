/**
 * sync-posts.js
 *
 * Deterministic create-or-update logic for posts.
 * Uses `client.gql` for GraphQL transport and `utils` for transformations.
 */

const {
  normalizeTags,
  resolveCoverImage,
} = require('./utils');

// Use a publication-scoped lookup to avoid deprecated/invalid fields
const FIND_POST_BY_SLUG = `
  query FindPostBySlug($publicationId: ObjectId!, $slug: String!) {
    publication(id: $publicationId) {
      post(slug: $slug) { id }
    }
  }
`;
const UPDATE_POST_MUTATION = `mutation UpdatePost($input: UpdatePostInput!) { updatePost(input: $input) { post { id } } }`;
const PUBLISH_POST_MUTATION = `mutation PublishPost($input: PublishPostInput!) { publishPost(input: $input) { post { id } } }`;

function extractPostIdFromResult(result) {
  // Flexible extraction to support varying shapes in tests
  if (!result) return null;
  if (result.post && result.post.id) return result.post.id;
  if (result.updatePost && result.updatePost.post && result.updatePost.post.id) return result.updatePost.post.id;
  if (result.publishPost && result.publishPost.post && result.publishPost.post.id) return result.publishPost.post.id;
  if (result.postBySlug && result.postBySlug.id) return result.postBySlug.id;
  if (result.posts && result.posts.length && result.posts[0].id) return result.posts[0].id;
  if (result.postsBySlug && result.postsBySlug.length && result.postsBySlug[0].id) return result.postsBySlug[0].id;
  if (result.publication && result.publication.post && result.publication.post.id) return result.publication.post.id;
  return null;
}

async function findPostIdBySlug(client, publicationId, slug) {
  const data = await client.gql(FIND_POST_BY_SLUG, { publicationId, slug });
  return extractPostIdFromResult(data);
}

async function updatePost(client, input) {
  const data = await client.gql(UPDATE_POST_MUTATION, { input });
  return extractPostIdFromResult(data);
}

async function publishPost(client, input) {
  const data = await client.gql(PUBLISH_POST_MUTATION, { input });
  return extractPostIdFromResult(data);
}

/**
 * Sync a single post: update if possible, otherwise create.
 * Strategy:
 *  - If frontmatter.cuid exists -> try update by id
 *  - Else, try find by slug -> update
 *  - Fallback to publish
 */
async function syncPost() {
  // Support both call styles:
  // 1) syncPost(client, { publicationId, frontmatter, body, env, dryRun })
  // 2) syncPost({ client, publicationId, frontmatter, body, env, dryRun })

  let client;
  let params = {};

  if (arguments.length === 2) {
    client = arguments[0];
    params = arguments[1] || {};
  } else if (arguments.length === 1 && arguments[0] && arguments[0].client) {
    params = Object.assign({}, arguments[0]);
    client = params.client;
    delete params.client;
  } else {
    throw new Error('Invalid arguments to syncPost');
  }

  const {
    publicationId,
    frontmatter,
    body,
    env = process.env,
    dryRun = false,
    sourcePath,
  } = params;

  const baseInput = {
    publicationId,
    title: frontmatter.title,
    contentMarkdown: body,
    slug: frontmatter.slug,
    tags: normalizeTags(frontmatter.tags),
    coverImageOptions: resolveCoverImage(frontmatter, env, dryRun, sourcePath),
  };

  // Try update by cuid if present (most reliable)
  if (frontmatter.cuid) {
    try {
      console.log(`✏️ Updating post: ${frontmatter.slug || frontmatter.cuid}`);

      if (dryRun) {
        console.log('   ↳ DRY-RUN: updatePost', { id: frontmatter.cuid, slug: frontmatter.slug });
        return { action: 'update', id: frontmatter.cuid, dryRun: true };
      }

      const updateInput = Object.assign({ id: frontmatter.cuid }, baseInput);
      const id = await updatePost(client, updateInput);
      if (id) return { action: 'update', id };
    } catch (e) {
      console.log(`   ↳ CUID update failed: ${e.message}, trying slug lookup...`);
      // fall through to slug lookup
    }
  }

  // Try find by slug (always check, except in pure dry-run mode)
  if (frontmatter.slug && !dryRun) {
    console.log(`   ↳ Looking up existing post by slug: ${frontmatter.slug}`);
    try {
      const existingId = await findPostIdBySlug(client, publicationId, frontmatter.slug);
      if (existingId) {
        console.log(`✏️ Updating post: ${frontmatter.slug} (found by slug)`);
        const updateInput = Object.assign({ id: existingId }, baseInput);
        const id = await updatePost(client, updateInput);
        if (id) return { action: 'update', id };
      }
    } catch (e) {
      console.log(`   ↳ Slug lookup failed: ${e.message}, proceeding cautiously...`);
      // If slug lookup fails, we should NOT fall back to publish without warning
      // Log it clearly so user can investigate
    }
  }

  // Publish (final fallback)
  // If we reach here, post was not found or updated
  if (!dryRun && !frontmatter.cuid && frontmatter.slug) {
    console.log(`   ⚠️ No cuid in frontmatter and no existing post found by slug. Publishing as NEW post.`);
    console.log(`   💡 TIP: After first publish, add the returned cuid to frontmatter to enable future updates.`);
  }

  console.log(`🆕 Creating post: ${frontmatter.slug}`);

  if (dryRun) {
    console.log('   ↳ DRY-RUN: publishPost', { slug: frontmatter.slug, publicationId });
    return { action: 'publish', id: 'dry-run', dryRun: true };
  }

  const publishInput = baseInput;
  const id = await publishPost(client, publishInput);
  return { action: 'publish', id };
}

module.exports = {
  syncPost,
  findPostIdBySlug,
  publishPost,
  updatePost,
  extractPostIdFromResult,
};
