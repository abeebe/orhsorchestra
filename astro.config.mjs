// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * gitLastmod -- returns the ISO 8601 date of the last git commit that touched
 * the content file for a given sitemap URL. Returns null for static pages
 * (home, about, boosters, contact) that have no corresponding content file.
 *
 * Ported from the MiniZMods astro.config.mjs reference implementation
 * (same pattern as senditslow, budgethomelab, ergodeskguide, resinandrolls).
 *
 * @param {string} pageUrl   Full URL from the sitemap item
 * @param {string} configUrl Pass `import.meta.url` from this file
 * @returns {string|null}
 */
function gitLastmod(pageUrl, configUrl) {
    try {
        const url = new URL(pageUrl);
        const clean = url.pathname.replace(/^\/|\/$/g, '');
        const segments = clean.split('/');
        if (segments.length < 2) return null;

        const [collection, slug] = segments;

        // orhsorchestra has a single content collection: 'news'.
        const CONTENT_COLLECTIONS = ['news'];
        if (!CONTENT_COLLECTIONS.includes(collection) || !slug) return null;

        const projectRoot = resolve(dirname(fileURLToPath(configUrl)));
        const filePath = `src/content/${collection}/${slug}.md`;
        if (!existsSync(join(projectRoot, filePath))) return null;

        const absPath = join(projectRoot, filePath);
        const result = execSync(
            `git log --format="%aI" -1 -- "${absPath}"`,
            { cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
        ).trim();

        return result || null;
    } catch {
        return null;
    }
}

/**
 * noindexStaticPagePaths -- derives sitemap URL paths for hand-written .astro
 * pages (i.e. not content-collection driven) that render a `noindex` robots
 * meta tag, so a page that ships noindex is dropped from the sitemap
 * automatically instead of needing a hardcoded slug added here every time
 * this site gains a noindex page later (ticket #2345: adding a sitemap
 * without this filter from the outset is exactly how the gap #2345 exists
 * to close got created on other sites in this portfolio).
 *
 * Ported from the MiniZMods / SendItSlow / BudgetHomelab reference
 * implementation. Dynamic routes (filenames containing `[`) are skipped --
 * their URLs can't be derived from the filename alone. orhsorchestra has one
 * (news/[id].astro), which is content-collection driven and has no noindex
 * tag today; this only matters if that ever changes.
 *
 * @param {string} configUrl Pass `import.meta.url` from this file
 * @returns {string[]} sitemap-relative paths, e.g. "/some-page/"
 */
function noindexStaticPagePaths(configUrl) {
    const projectRoot = resolve(dirname(fileURLToPath(configUrl)));
    const pagesDir = join(projectRoot, 'src/pages');
    const excluded = [];
    const ROBOTS_NOINDEX = /name=["']robots["']\s+content=["'][^"']*noindex/i;

    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.name.endsWith('.astro') || entry.name.includes('[')) continue;
            const raw = readFileSync(full, 'utf8');
            if (!ROBOTS_NOINDEX.test(raw)) continue;

            const rel = full.slice(pagesDir.length).replace(/\\/g, '/');
            const routePath = rel === '/index.astro'
                ? '/'
                : rel.replace(/\/index\.astro$/, '/').replace(/\.astro$/, '/');
            excluded.push(routePath);
        }
    }

    if (existsSync(pagesDir)) walk(pagesDir);
    return excluded;
}

// Computed once at config-eval time (not per sitemap-filter call): every
// sitemap path that should be dropped because the page itself ships noindex,
// rather than because of a hardcoded slug. None exist today -- this is
// future-proofing so a later noindex page never silently leaks into the
// sitemap (see #2345 notes: that's exactly how the original portfolio-wide
// gap this ticket closes was created).
const noindexExcludedPaths = new Set(noindexStaticPagePaths(import.meta.url));

// https://astro.build/config
export default defineConfig({
  // NOTE (#2345): orhsorchestra.org is currently serving a separate, older
  // Apache-hosted site, not this Astro/Netlify codebase (confirmed by HTTP
  // headers -- `server: Apache`, redirects to /index.html, not Netlify's
  // signature). This repo may not be deployed to that domain yet. `site` is
  // set to the domain this codebase is presumably intended for; Aaron should
  // confirm or correct once this repo's actual deploy target is known --
  // sitemap URLs are wrong if this doesn't match wherever it actually lands.
  site: 'https://orhsorchestra.org',

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: netlify(),

  integrations: [
    sitemap({
      // Drop any page that ships its own noindex robots meta tag -- derived
      // from the page source itself (see noindexExcludedPaths above), not
      // hardcoded here, so this never goes stale (#2345, portfolio pattern).
      filter: (page) => {
        const path = new URL(page).pathname;
        return !noindexExcludedPaths.has(path);
      },
      // Emit real git-based lastmod dates so Googlebot can prioritise
      // recently-updated content correctly, instead of a build-time
      // timestamp that is identical across every URL and changes on every
      // deploy -- the exact defect Archer found starving crawl priority on
      // other sites in this portfolio (report slug
      // archer-hub-indexing-p0-2026-08-24). Shipping this from day one
      // avoids recreating that bug in a brand-new sitemap.
      serialize(item) {
        item.lastmod = gitLastmod(item.url, import.meta.url) ?? new Date().toISOString().split('T')[0];
        return item;
      },
    }),
  ],
});
