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

function normalizeAuthHeader(token) {
  const t = String(token || '').trim();
  if (!t) return '';

  // If the caller already provided a scheme, keep it.
  // Examples: "Bearer <token>", "Token <token>"
  if (/^[A-Za-z]+\s+\S+/.test(t)) return t;

  // Match the validator workflow style.
  return `Bearer ${t}`;
}

/**
 * Create a Hashnode GraphQL client
 *
 * @param {string} token - Hashnode Personal Access Token
 */
function createHashnodeClient(token) {
  if (!token) {
    throw new Error("HASHNODE_PAT is required — pass a token to createHashnodeClient(token) or set the environment variable HASHNODE_PAT.\n\nExamples:\n  PowerShell: $env:HASHNODE_PAT = 'your_token'\n  Bash: export HASHNODE_PAT=your_token\n");
  }

  const authorization = normalizeAuthHeader(token);

  /**
   * Execute a GraphQL operation
   *
   * @param {string} query
   * @param {object} variables
   */
  async function gql(query, variables = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('GraphQL query must be a string');
    }

    const res = await fetch(HASHNODE_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
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

    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`Hashnode response was not valid JSON: ${e.message}`);
    }

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
