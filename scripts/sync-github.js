// scripts/sync-github.js
// Fetches all public repos for GITHUB_USERNAME and writes them to src/data/repos.json
// Run: node scripts/sync-github.js

import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;

if (!USERNAME) {
    console.error('❌ GITHUB_USERNAME is not set in .env');
    process.exit(1);
}

const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchAllRepos() {
    const all = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `https://api.github.com/users/${USERNAME}/repos?per_page=${perPage}&page=${page}&sort=updated`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
            throw new Error(`GitHub API ${res.status} — ${await res.text()}`);
        }

        const batch = await res.json();
        all.push(...batch);

        if (batch.length < perPage) break;
        page++;
    }

    return all;
}

function simplify(repo) {
    return {
        id: repo.id,
        name: repo.name,
        slug: repo.name,                 // URL slug
        description: repo.description || '',
        homepage: repo.homepage || '',   // ← this is the "Website" field
        html_url: repo.html_url,
        language: repo.language || '',
        topics: repo.topics || [],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        pushed_at: repo.pushed_at,
        created_at: repo.created_at,
        archived: repo.archived,
        fork: repo.fork,
    };
}

async function main() {
    console.log(`🔄 Fetching repos for ${USERNAME}...`);
    const repos = await fetchAllRepos();

    // Filter: exclude forks, archived, and repos with a specific "hide" topic
    const cleaned = repos
        .filter(r => !r.fork && !r.archived && !(r.topics || []).includes('hide'))
        .map(simplify)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    console.log(`✅ ${cleaned.length} repos kept (out of ${repos.length} total).`);

    const outPath = resolve(__dirname, '..', 'src', 'data', 'repos.json');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(cleaned, null, 2));
    console.log(`💾 Wrote ${outPath}`);
}

main().catch(err => {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
});