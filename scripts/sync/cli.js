#!/usr/bin/env node
/**
 * cli.js
 *
 * Public CLI entry for hashnode-sync
 */

const { runSync } = require('./run-sync');

function printHelp() {
  console.log(`
hashnode-sync

Usage:
  hashnode-sync [options]

Options:
  --tech         Sync tech posts only
  --personal     Sync personal posts only
  --all          Sync both (default)
  -h, --help     Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const options = {
    tech: args.includes('--personal') ? false : true,
    personal: args.includes('--tech') ? false : true,
  };

  await runSync(options);
}

main().catch(err => {
  console.error('\n❌ Sync failed');
  console.error(err.message);
  process.exit(1);
});
