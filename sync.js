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
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/merge-upstream`;

    async function doMerge(targetBranch) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch: targetBranch }),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }

    // 第一次使用传入的 branch 尝试
    let { res, data } = await doMerge(branch);

    // 若分支不存在，自动回退到 GitHub 默认分支再试一次
    if (
      !res.ok &&
      data &&
      typeof data.message === 'string' &&
      /branch not found/i.test(data.message)
    ) {
      const infoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (infoRes.ok) {
        const info = await infoRes.json().catch(() => ({}));
        const defBranch = info && info.default_branch;
        if (defBranch && defBranch !== branch) {
          ({ res, data } = await doMerge(defBranch));
          // 成功的话，调用方可以根据需要把本地记录的分支更新为 defBranch
        }
      }
    }

    // GitHub 在分支未落后时会返回类似：
    // "This branch is not behind the upstream xxx:main."
    // 成功快进时会返回：
    // "Successfully fetched and fast-forwarded from upstream xxx:main."
    // 先把这些英文统一转换成中文。
    if (
      data &&
      typeof data.message === 'string' &&
      data.message.includes('This branch is not behind the upstream')
    ) {
      data.message = '当前主分支已是最新';
    } else if (
      data &&
      typeof data.message === 'string' &&
      /Successfully fetched and fast-forwarded from upstream/i.test(data.message)
    ) {
      data.message = '已从上游同步最新代码';
    }

    if (!res.ok) {
      let msg = data.message || data.error || res.statusText || '';
      // GitHub 在分支未落后（无可同步提交）时通常返回 409，这里统一转成中文提示
      if (res.status === 409) {
        msg = '当前主分支已是最新';
      }
      return { success: false, message: msg, status: res.status };
    }
    return { success: true, data, message: data.message || '已从上游同步最新代码' };
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
