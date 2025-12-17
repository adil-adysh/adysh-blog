// Placeholder entrypoint for syncing posts to Hashnode
// CLI flags: --dry-run, --only

const { gql } = require('./hashnode-client')

async function main() {
  console.log('sync-posts placeholder')
}

if (require.main === module) main()

module.exports = { main }
