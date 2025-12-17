/**
 * @file sync-series.test.js
 *
 * Unit tests for series sync logic.
 * Controlled filesystem + mocked GraphQL client.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  ensureSeries,
  addPostToSeries,
  syncSeriesFolder,
} = require('../sync-series');

describe('sync-series', () => {
  let tempDir;
  let client;

  const publicationId = 'pub-123';
  const env = {
    GITHUB_REPOSITORY: 'user/repo',
    GITHUB_SHA: 'sha123',
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'series-test-'));

    client = {
      gql: jest.fn(async (query, variables) => {
        if (query.includes('series(slug')) {
          return { series: null };
        }

        if (query.includes('createSeries')) {
          return { createSeries: { series: { id: 'series-id' } } };
        }

        if (query.includes('updateSeries')) {
          return { updateSeries: { series: { id: 'series-id' } } };
        }

        if (query.includes('addPostToSeries')) {
          return { addPostToSeries: { series: { id: 'series-id' } } };
        }

        throw new Error('Unexpected GraphQL call');
      }),
    };
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  test('creates series when it does not exist', async () => {
    const seriesFm = {
      name: 'Test Series',
      slug: 'test-series',
    };

    const id = await ensureSeries(client, seriesFm, publicationId, env);

    expect(id).toBe('series-id');
    expect(client.gql).toHaveBeenCalled();
  });

  test('adds post to series (append-only)', async () => {
    await addPostToSeries(client, 'post-1', 'series-1');

    const call = client.gql.mock.calls[0][1].input;

    expect(call.postId).toBe('post-1');
    expect(call.seriesId).toBe('series-1');
  });

  test('syncSeriesFolder processes posts in filename order', async () => {
    // Create _series.md
    fs.writeFileSync(
      path.join(tempDir, '_series.md'),
      `---
name: Ordered Series
slug: ordered-series
---`
    );

    // Create posts out of order
    fs.writeFileSync(
      path.join(tempDir, '02-second.md'),
      `---
title: Second
slug: second
---
Second body`
    );

    fs.writeFileSync(
      path.join(tempDir, '01-first.md'),
      `---
title: First
slug: first
---
First body`
    );

    const syncPostMock = jest.fn(async ({ frontmatter }) => ({
      id: `post-${frontmatter.slug}`,
    }));

    await syncSeriesFolder({
      client,
      folderPath: tempDir,
      publicationId,
      syncPost: syncPostMock,
      env,
    });

    // Posts synced in order
    expect(syncPostMock.mock.calls[0][0].frontmatter.slug).toBe('first');
    expect(syncPostMock.mock.calls[1][0].frontmatter.slug).toBe('second');

    // addPostToSeries called twice
    const addCalls = client.gql.mock.calls.filter(call =>
      call[0].includes('addPostToSeries')
    );

    expect(addCalls.length).toBe(2);
  });

  test('throws if _series.md is missing', async () => {
    await expect(
      syncSeriesFolder({
        client,
        folderPath: tempDir,
        publicationId,
        syncPost: jest.fn(),
      })
    ).rejects.toThrow('_series.md not found');
  });
});
