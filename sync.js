/**
 * 使用 GitHub API 将 fork 仓库与上游同步
 * API: POST /repos/{owner}/{repo}/merge-upstream
 */

const GITHUB_API = 'https://api.github.com';

/**
 * 同步单个 fork 仓库
 * @param {string} owner - fork 仓库的 owner
 * @param {string} repo - fork 仓库的 repo 名
 * @param {string} branch - 要同步的分支，默认 main
 * @param {string} token - GitHub Personal Access Token
 * @returns {{ success: boolean, message?: string, data?: object }}
 */
export async function syncOne(owner, repo, branch = 'main', token) {
  if (!token) {
    return { success: false, message: '未配置 GITHUB_TOKEN' };
  }
  const url = `${GITHUB_API}/repos/${owner}/${repo}/merge-upstream`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branch }),
    });
    const data = await res.json().catch(() => ({}));

    // GitHub 在分支未落后时会返回类似：
    // "This branch is not behind the upstream xxx:main."
    // 无论状态码是多少，都先把这类英文统一转换成中文。
    if (
      data &&
      typeof data.message === 'string' &&
      data.message.includes('This branch is not behind the upstream')
    ) {
      data.message = '当前主分支已是最新';
    }

    if (!res.ok) {
      let msg = data.message || data.error || res.statusText || '';
      // GitHub 在分支未落后（无可同步提交）时通常返回 409，这里统一转成中文提示
      if (res.status === 409) {
        msg = '当前主分支已是最新';
      }
      return { success: false, message: msg, status: res.status };
    }
    return { success: true, data, message: data.message || '同步成功' };
  } catch (err) {
    let msg = err.message || '请求失败';
    if (/not behind/i.test(msg) && /upstream/i.test(msg)) {
      msg = '当前主分支已是最新';
    }
    return { success: false, message: msg };
  }
}

/**
 * 批量同步多个 fork
 * @param {Array<{ owner: string, repo: string, branch?: string }>} repos
 * @param {string} token
 * @returns {Promise<Array<{ id: string, success: boolean, message?: string }>>}
 */
export async function syncAll(repos, token) {
  const results = [];
  for (const r of repos) {
    const result = await syncOne(r.owner, r.repo, r.branch || 'main', token);
    results.push({
      id: r.id,
      owner: r.owner,
      repo: r.repo,
      success: result.success,
      message: result.message,
      data: result.data,
    });
  }
  return results;
}
