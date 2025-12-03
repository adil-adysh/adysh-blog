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

**B. Use the Frontmatter Template:**

At the very top of your new Markdown file, include a frontmatter block. This metadata is essential for how your post will appear on each platform.

Here is the recommended template. Copy and paste this at the top of each new post and fill in the details:

```yaml
---
title: "Your Awesome Post Title"
description: "A short, compelling summary of your article. This is often used for social media previews."
tags: "tech, programming, go, development"
published: true
canonical_url: "https://your-blog.hashnode.dev/your-post-slug"
---

## Your Post Starts Here

Start writing your amazing blog post content in Markdown below the frontmatter.
```

**Frontmatter Explained:**

- **`title`**: The title of your article.
- **`description`**: A brief summary used for SEO and social sharing.
- **`tags`**: A comma-separated list of tags for your post.
- **`published`**: Set to `true` for dev.to to publish the article immediately.
- **`canonical_url`**: **Very Important for SEO!** This tells search engines that the primary version of your article is on your Hashnode blog. This should be the final URL of your post on your main blog (which you should set to Hashnode for this setup).

### 3. The Automation

Once your post is ready, all you need to do is **commit and push the new file to the `main` branch**.

The GitHub Action will automatically:
1.  Detect the new or updated post in the `/posts` directory.
2.  Publish it to your Hashnode blog.
3.  Publish it to your dev.to account.
4.  Publish the specific file `posts/example-post.md` to Medium (you can update this in the workflow file or enhance the workflow to detect the latest changed file).

Your repository is now a single source of truth for all your technical articles!
