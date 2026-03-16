/**
 * 简单的 JSON 文件存储：fork 仓库列表
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const REPOS_JSON = path.join(DATA_DIR, 'repos.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRepos() {
  ensureDataDir();
  if (!fs.existsSync(REPOS_JSON)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(REPOS_JSON, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeRepos(repos) {
  ensureDataDir();
  fs.writeFileSync(REPOS_JSON, JSON.stringify(repos, null, 2), 'utf-8');
}

/** 生成简单唯一 id */
function nextId(repos) {
  const max = repos.reduce((m, r) => Math.max(m, parseInt(r.id, 10) || 0), 0);
  return String(max + 1);
}

export function listRepos() {
  return readRepos();
}

export function addMany(reposToAdd) {
  const current = readRepos();
  let repos = [...current];
  let changed = 0;
  for (const r of reposToAdd) {
    const exists = repos.find(
      (x) =>
        x.owner.toLowerCase() === r.owner.toLowerCase() &&
        x.repo.toLowerCase() === r.repo.toLowerCase()
    );
    if (exists) continue;
    const id = nextId(repos);
    const item = {
      id,
      owner: r.owner,
      repo: r.repo,
      branch: r.branch || 'main',
      label: r.label || `${r.owner}/${r.repo}`,
    };
    repos.push(item);
    changed++;
  }
  if (changed > 0) {
    writeRepos(repos);
  }
  return { ok: true, added: changed, total: repos.length };
}

export function addRepo(owner, repo, branch = 'main', label = '') {
  const repos = readRepos();
  const existing = repos.find(
    (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase()
  );
  if (existing) {
    return { ok: false, message: '该仓库已存在' };
  }
  const id = nextId(repos);
  const item = { id, owner, repo, branch, label: label || `${owner}/${repo}` };
  repos.push(item);
  writeRepos(repos);
  return { ok: true, item };
}

export function removeRepo(id) {
  const repos = readRepos().filter((r) => r.id !== id);
  if (repos.length === readRepos().length) {
    return { ok: false, message: '未找到该仓库' };
  }
  writeRepos(repos);
  return { ok: true };
}

export function getRepo(id) {
  return readRepos().find((r) => r.id === id);
}

export function updateRepo(id, updates) {
  const repos = readRepos();
  const idx = repos.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, message: '未找到该仓库' };
  repos[idx] = { ...repos[idx], ...updates };
  writeRepos(repos);
  return { ok: true, item: repos[idx] };
}
