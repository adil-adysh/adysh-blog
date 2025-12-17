/**
 * @file hashnode-client.test.js
 *
 * Tests ONLY the GraphQL transport contract.
 * No real HTTP calls.
 */

const { createHashnodeClient } = require('../hashnode-client');

describe('hashnode-client', () => {
  const TOKEN = 'test-token';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('throws if token is missing', () => {
    expect(() => createHashnodeClient()).toThrow(
      'HASHNODE_PAT is required'
    );
  });

  test('sends correct GraphQL request', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { me: { username: 'adil' } } }),
    });

    const client = createHashnodeClient(TOKEN);

    const query = `query { me { username } }`;
    const data = await client.gql(query);

    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, options] = fetch.mock.calls[0];

    expect(url).toBe('https://gql.hashnode.com');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe(TOKEN);

    const body = JSON.parse(options.body);
    expect(body.query).toBe(query);
    expect(body.variables).toEqual({});
    expect(data.me.username).toBe('adil');
  });

  test('passes variables correctly', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { post: { id: '123' } } }),
    });

    const client = createHashnodeClient(TOKEN);

    const query = `query ($id: ID!) { post(id: $id) { id } }`;
    const variables = { id: '123' };

    await client.gql(query, variables);

    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.variables).toEqual(variables);
  });

  test('throws on HTTP error', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const client = createHashnodeClient(TOKEN);

    await expect(
      client.gql('query { me { username } }')
    ).rejects.toThrow('Hashnode HTTP error 401');
  });

  test('throws on GraphQL errors', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Invalid token' }],
      }),
    });

    const client = createHashnodeClient(TOKEN);

    await expect(
      client.gql('query { me { username } }')
    ).rejects.toThrow('Hashnode GraphQL error');
  });

  test('throws if response has no data', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const client = createHashnodeClient(TOKEN);

    await expect(
      client.gql('query { me { username } }')
    ).rejects.toThrow('Hashnode response missing data');
  });
});
