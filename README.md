# Blog Automation: Publish to Hashnode, dev.to, and Medium

This repository contains a GitHub Actions workflow to automatically publish your blog posts from a single source to Hashnode, dev.to, and Medium.

## How to Use This Repository

Follow these steps to get started:

### 1. Initial Setup

Before you start writing, you need to configure the repository to connect to your blogging platforms.

**A. Add Secrets:**

Go to your repository's **Settings > Secrets and variables > Actions** and add the following repository secrets:

- `HASHNODE_KEY`: Your Hashnode API key from your Hashnode Developer settings.
- `DEVTO_TOKEN`: Your dev.to API key from your dev.to Settings.
- `MEDIUM_INTEGRATION_TOKEN`: Your Medium integration token from your Medium Settings.

**B. Update Workflow File:**

In the `.github/workflows/publish-blog.yml` file, replace the placeholder for the Hashnode `host` with your actual Hashnode blog URL:

- **Find:** `host: "https://<your-hashnode-blog>.hashnode.dev"`
- **Replace with:** `host: "https://your-blog.hashnode.dev"` (or your custom domain).

### 2. Writing a New Post

**A. Create a File:**

To write a new blog post, simply create a new Markdown file (`.md`) inside the `/posts` directory. The name of the file will become the URL slug for your post (e.g., `my-first-post.md`).

**B. Use the Unified Frontmatter Template:**

At the very top of your new Markdown file, include a YAML frontmatter block. This metadata is essential for how your post will appear on each platform. Using a unified template ensures that Hashnode, dev.to, and the Medium GitHub Action can all read the necessary metadata.

A template file `posts/template.md` is provided in this repository. Copy the content of this file for your new blog posts.

```yaml
---
# Shared core metadata
title: "Building a Flutter A11y Linter That Actually Understands Semantics"
subtitle: "How I designed a semantic IR and 20+ accessibility rules for Flutter"
description: "Deep dive into building a semantics-first accessibility linter for Flutter with a custom IR and rule engine."

# Hashnode-specific (required for GitHub-as-source)
slug: flutter-a11y-linter-semantics-ir
domain: your-blog.hashnode.dev

# Tags (works for all three)
# - Hashnode: up to 5 tags (slugs)
# - dev.to: first 4 tags used
# - Medium: action treats this as tags list (comma-separated)
tags: flutter, accessibility, dart, a11y

# Canonical URL
# - Hashnode: uses `canonical`
# - dev.to: uses `canonical_url`
# - Medium: action reads `canonical_url`
canonical: https://your-blog.hashnode.dev/flutter-a11y-linter-semantics-ir
canonical_url: https://your-blog.hashnode.dev/flutter-a11y-linter-semantics-ir

# Cover images
# - Hashnode: `cover`
# - dev.to: `cover_image`
cover: https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/flutter-a11y-cover.png
cover_image: https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/flutter-a11y-cover.png

# Series / grouping (optional)
series: flutter-a11y-series
seriesSlug: flutter-a11y-series  # Hashnode series support

# Publish/draft flags
# - dev.to: `published`
# - Hashnode: `saveAsDraft` (false = publish)
# - Medium: via action `publish_status` (can also be in frontmatter)
published: true
saveAsDraft: false
publish_status: public

# Hashnode extra SEO goodies (optional, but nice)
seoTitle: "Flutter Accessibility Linter with Semantic IR (A11y for Real Apps)"
seoDescription: "A practical, semantics-aware Flutter accessibility linter: image roles, tap targets, hidden focus traps, and more."
enableToc: true
---
```

### Why this works

*   **Hashnode**:
    *   Uses `title`, `slug`, `tags`, `domain` as required fields.
    *   Uses `canonical` as the original URL (when republishing elsewhere).
    *   Ignores unknown fields like `published`, `cover_image`, `canonical_url`, `publish_status`.

*   **dev.to**:
    *   Uses `title`, `published`, `tags`, `canonical_url`, `cover_image`, `series`.
    *   Ignores Hashnode-specific fields like `domain`, `slug`, `seoTitle`, etc.

*   **Medium (action)**:
    *   With `parse_frontmatter: "true"`, it reads `title`, `tags`, `canonical_url`, and `publish_status`.
    *   Ignores extra fields without breaking.

The “extra” fields are harmless on platforms that don’t recognize them.

### A few practical guidelines

1.  **Pick your canonical “home” once.**
    *   This should be your **Hashnode** blog.
    *   Both `canonical` and `canonical_url` should point to your Hashnode URL.

2.  **Keep tags ≤ 4–5 and ordered by importance.**
    *   dev.to uses the **first 4** tags.
    *   Medium and Hashnode use **up to 5**.
    *   Put your *best* tags first.

3.  **Use the same cover image URL everywhere.**
    *   Use a stable URL (Hashnode CDN, your own site, or an S3 bucket).
    *   Set both `cover` and `cover_image` to it.

4.  **Control drafts per platform via workflow settings.**
    *   You can leave `publish_status: draft` for Medium at first, even if `published: true` for dev.to and `saveAsDraft: false` for Hashnode.
    *   Or override per-platform in your GitHub Action inputs.

### 3. The Automation

Once your post is ready, all you need to do is **commit and push the new file to the `main` branch**.

The GitHub Action will automatically:
1.  Detect the new or updated post in the `/posts` directory.
2.  Publish it to your Hashnode blog.
3.  Publish it to your dev.to account.
4.  Publish it to Medium.

Your repository is now a single source of truth for all your technical articles!
