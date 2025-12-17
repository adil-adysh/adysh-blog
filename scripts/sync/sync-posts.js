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

const FIND_POST_BY_SLUG = `query FindPostBySlug($publicationId: ID!, $slug: String!) { postBySlug(publicationId: $publicationId, slug: $slug) { id } }`;
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
async function syncPost(client, { publicationId, frontmatter, body, env = process.env }) {
  const baseInput = {
    publicationId,
    title: frontmatter.title,
    contentMarkdown: body,
    slug: frontmatter.slug,
    tags: normalizeTags(frontmatter.tags),
    coverImageOptions: resolveCoverImage(frontmatter, env),
  };

  // Try update by cuid if present
  if (frontmatter.cuid) {
    try {
      const updateInput = Object.assign({ id: frontmatter.cuid }, baseInput);
      const id = await updatePost(client, updateInput);
      if (id) return { action: 'update', id };
    } catch (e) {
      // fall through to publish
    }
  }

  // Try find by slug
  if (frontmatter.slug) {
    const existingId = await findPostIdBySlug(client, publicationId, frontmatter.slug);
    if (existingId) {
      const updateInput = Object.assign({ id: existingId }, baseInput);
      try {
        const id = await updatePost(client, updateInput);
        if (id) return { action: 'update', id };
      } catch (e) {
        // fall through to publish
      }
    }
  }

  // Publish
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
