/**
 * @file utils.test.js
 *
 * Unit tests for pure helper utilities.
 * No filesystem. No network. No side effects.
 */

const {
  splitFrontmatter,
  validateFrontmatter,
  assetPathToRawUrl,
  normalizeTags,
  resolveCoverImage,
} = require('../utils');

describe('utils.js', () => {
  describe('splitFrontmatter', () => {
    test('splits valid frontmatter and body', () => {
      const raw = `---
title: Test Post
slug: test-post
tags:
  - test
---
Hello world
`;

      const { frontmatter, body } = splitFrontmatter(raw);

      expect(frontmatter.title).toBe('Test Post');
      expect(frontmatter.slug).toBe('test-post');
      expect(frontmatter.tags).toEqual(['test']);
      expect(body).toBe('Hello world');
    });

    test('throws if missing frontmatter', () => {
      const raw = `Hello world`;
      expect(() => splitFrontmatter(raw)).toThrow(
        'Frontmatter must start with ---'
      );
    });

    test('throws on malformed frontmatter', () => {
      const raw = `---
title: Test
Hello world`;
      expect(() => splitFrontmatter(raw)).toThrow(
        'Invalid frontmatter format'
      );
    });

    test('throws on invalid YAML', () => {
      const raw = `---
title: [unclosed
---
body`;
      expect(() => splitFrontmatter(raw)).toThrow();
    });
  });

  describe('validateFrontmatter', () => {
    test('passes when required keys exist', () => {
      expect(() =>
        validateFrontmatter({ title: 'x', slug: 'y' }, ['title', 'slug'])
      ).not.toThrow();
    });

    test('throws when required key is missing', () => {
      expect(() =>
        validateFrontmatter({ title: 'x' }, ['title', 'slug'], 'test.md')
      ).toThrow("Missing required frontmatter key 'slug'");
    });
  });

  describe('assetPathToRawUrl', () => {
    const env = {
      GITHUB_REPOSITORY: 'user/repo',
      GITHUB_SHA: 'abc123',
    };

    test('returns correct raw GitHub URL', () => {
      const url = assetPathToRawUrl('assets/image.png', env);
      expect(url).toBe(
        'https://raw.githubusercontent.com/user/repo/abc123/assets/image.png'
      );
    });

    test('throws if env vars missing', () => {
      expect(() =>
        assetPathToRawUrl('assets/x.png', {})
      ).toThrow('GITHUB_REPOSITORY and GITHUB_SHA are required');
    });

    test('returns null for empty path', () => {
      expect(assetPathToRawUrl(null, env)).toBeNull();
    });
  });

  describe('normalizeTags', () => {
    test('converts string tags to Hashnode format', () => {
      const tags = normalizeTags(['a', 'b']);
      expect(tags).toEqual([{ name: 'a' }, { name: 'b' }]);
    });

    test('returns empty array for undefined', () => {
      expect(normalizeTags()).toEqual([]);
    });

    test('throws if tags is not an array', () => {
      expect(() => normalizeTags('tag')).toThrow('tags must be an array');
    });

    test('throws if tag value is not string', () => {
      expect(() => normalizeTags(['ok', 1])).toThrow(
        'tag values must be strings'
      );
    });
  });

  describe('resolveCoverImage', () => {
    const env = {
      GITHUB_REPOSITORY: 'user/repo',
      GITHUB_SHA: 'abc123',
    };

    test('resolves cover field', () => {
      const result = resolveCoverImage(
        { cover: 'assets/cover.png' },
        env
      );

      expect(result).toEqual({
        coverImageURL:
          'https://raw.githubusercontent.com/user/repo/abc123/assets/cover.png',
      });
    });

    test('resolves coverImage fallback', () => {
      const result = resolveCoverImage(
        { coverImage: 'assets/alt.png' },
        env
      );

      expect(result.coverImageURL).toContain('assets/alt.png');
    });

    test('returns null if no cover present', () => {
      expect(resolveCoverImage({}, env)).toBeNull();
    });
  });
});
