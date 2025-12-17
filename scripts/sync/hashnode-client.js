// Minimal placeholder for Hashnode GraphQL client
// Implement auth, gql requests, retries here.

const fetch = require('node-fetch');

function gql(endpoint, token, query, variables) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? token : undefined
    },
    body: JSON.stringify({ query, variables })
  }).then(r => r.json())
}

module.exports = { gql }
