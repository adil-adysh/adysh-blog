/**
 * Hashnode GraphQL client
 *
 * Responsibilities:
 * - Send GraphQL requests
 * - Enforce explicit failure on API errors
 * - No business logic
 * - No retries
 */

const HASHNODE_GQL_ENDPOINT = 'https://gql.hashnode.com';

/**
 * Create a Hashnode GraphQL client
 *
 * @param {string} token - Hashnode Personal Access Token
 */
function createHashnodeClient(token) {
  if (!token) {
    throw new Error('HASHNODE_PAT is required');
  }

  /**
   * Execute a GraphQL operation
   *
   * @param {string} query
   * @param {object} variables
   */
  async function gql(query, variables = {}) {
    const res = await fetch(HASHNODE_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Hashnode HTTP error ${res.status}: ${text}`
      );
    }

    const json = await res.json();

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Hashnode GraphQL error:\n${JSON.stringify(json.errors, null, 2)}`
      );
    }

    if (!json.data) {
      throw new Error('Hashnode response missing data');
    }

    return json.data;
  }

  return {
    gql,
  };
}

module.exports = {
  createHashnodeClient,
};
