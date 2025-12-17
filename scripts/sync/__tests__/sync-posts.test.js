const {
  syncPost,
  findPostIdBySlug,
  publishPost,
  updatePost,
} = require('../sync-posts');

describe('sync-posts', () => {
  const publicationId = 'pub-1';
  const env = { GITHUB_REPOSITORY: 'user/repo', GITHUB_SHA: 'abc123' };

  test('publishes when no cuid and slug not found', async () => {
    const client = { gql: jest.fn() };

    // find by slug -> returns null
    client.gql.mockResolvedValueOnce({});

    // publish returns id
    client.gql.mockResolvedValueOnce({ publishPost: { post: { id: 'p1' } } });

    const frontmatter = { title: 'T', slug: 's', tags: ['a'], cover: 'assets/c.png' };
    const body = 'body';

    const res = await syncPost(client, { publicationId, frontmatter, body, env });

    expect(res.action).toBe('publish');
    expect(res.id).toBe('p1');

    // second call was publish
    expect(client.gql).toHaveBeenCalledTimes(2);
    const [, publishCall] = client.gql.mock.calls[1];
    // client.gql(query, variables) -> variables is the second arg
    expect(publishCall.input.tags).toEqual([{ name: 'a' }]);
    expect(publishCall.input.coverImageOptions.coverImageURL).toContain('assets/c.png');
  });

  test('updates when cuid present', async () => {
    const client = { gql: jest.fn() };
    client.gql.mockResolvedValueOnce({ updatePost: { post: { id: 'u1' } } });

    const frontmatter = { title: 'T', slug: 's', tags: ['a'], cuid: 'c-1' };
    const body = 'body';

    const res = await syncPost(client, { publicationId, frontmatter, body, env });

    expect(res.action).toBe('update');
    expect(res.id).toBe('u1');

    expect(client.gql).toHaveBeenCalledTimes(1);
    const [mutation, vars] = client.gql.mock.calls[0];
    expect(mutation).toMatch(/UpdatePost/);
    expect(vars.input.id).toBe('c-1');
  });

  test('updates when slug found', async () => {
    const client = { gql: jest.fn() };

    // find by slug -> returns id
    client.gql.mockResolvedValueOnce({ postBySlug: { id: 's1' } });
    // update
    client.gql.mockResolvedValueOnce({ updatePost: { post: { id: 's1' } } });

    const frontmatter = { title: 'T', slug: 's', tags: ['a'] };
    const body = 'body';

    const res = await syncPost(client, { publicationId, frontmatter, body, env });

    expect(res.action).toBe('update');
    expect(res.id).toBe('s1');

    expect(client.gql).toHaveBeenCalledTimes(2);
    const [findCall] = client.gql.mock.calls[0];
    expect(findCall).toMatch(/FindPostBySlug/);
  });

  test('fallback to publish when update fails', async () => {
    const client = { gql: jest.fn() };

    // find by slug -> returns id
    client.gql.mockResolvedValueOnce({ postBySlug: { id: 's2' } });
    // update fails
    client.gql.mockRejectedValueOnce(new Error('GraphQL error'));
    // publish succeeds
    client.gql.mockResolvedValueOnce({ publishPost: { post: { id: 'p2' } } });

    const frontmatter = { title: 'T', slug: 's', tags: ['a'] };
    const body = 'body';

    const res = await syncPost(client, { publicationId, frontmatter, body, env });

    expect(res.action).toBe('publish');
    expect(res.id).toBe('p2');

    expect(client.gql).toHaveBeenCalledTimes(3);
  });

  test('dry-run skips publish and logs intent', async () => {
    const client = { gql: jest.fn() };

    // find by slug -> returns null
    client.gql.mockResolvedValueOnce({});

    const frontmatter = { title: 'T', slug: 's', tags: ['a'] };
    const body = 'body';

    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await syncPost(client, { publicationId, frontmatter, body, env, dryRun: true });

    expect(res.action).toBe('publish');
    expect(res.dryRun).toBe(true);
    expect(res.id).toBe('dry-run');

    // Only slug lookup was performed
    expect(client.gql).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();

    log.mockRestore();
  });

  test('dry-run skips update by cuid and logs intent', async () => {
    const client = { gql: jest.fn() };

    const frontmatter = { title: 'T', slug: 's', tags: ['a'], cuid: 'c-1' };
    const body = 'body';

    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await syncPost(client, { publicationId, frontmatter, body, env, dryRun: true });

    expect(res.action).toBe('update');
    expect(res.dryRun).toBe(true);
    expect(res.id).toBe('c-1');

    // No GraphQL calls should be made for update-by-id in dry-run
    expect(client.gql).toHaveBeenCalledTimes(0);
    expect(log).toHaveBeenCalled();

    log.mockRestore();
  });
});
