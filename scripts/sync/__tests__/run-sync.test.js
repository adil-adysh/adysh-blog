const fs = require('fs');
const path = require('path');
const os = require('os');

const { runSync } = require('../run-sync');

describe('run-sync', () => {
  let tmp;
  const env = { PERSONAL_PUBLICATION_ID: 'pub-1' };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-sync-'));
    // create posts/personal/01-first.md
    fs.mkdirSync(path.join(tmp, 'posts', 'personal'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'posts', 'personal', '01-first.md'),
      `---\ntitle: First\nslug: first\n---\nFirst body`
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('dry-run works without HASHNODE_PAT', async () => {
    const origCwd = process.cwd();
    process.chdir(tmp);

    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await expect(runSync({ personal: true, tech: false, dryRun: true }, env)).resolves.not.toThrow();

      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      process.chdir(origCwd);
    }
  });
});
