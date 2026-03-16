# Fork 仓库同步管理（GitHub Fork Sync Dashboard）

通过一个简单的 Web 页面，集中管理你所有的 GitHub Fork 仓库：  
**一键批量同步、智能导入、自动刷新上游信息、清理脏数据**，让 Fork 不再失控。

---

## ✨ 功能亮点

- **一键同步 Fork**：支持单仓库同步，也支持一键批量同步所有已配置 Fork，统一用中文提示「当前主分支已是最新」等状态。
- **一键导入 Fork**：从当前 Token 对应账号中一键导入所有 Fork 仓库，并自动补齐 Fork / 上游的最近时间与最新 commit 信息。
- **自动刷新与清理脏数据**：后台刷新上游信息，自动移除在 GitHub 上已删除或已取消 Fork 关系的仓库，列表按最近更新时间倒序展示。
- **智能添加仓库**：`Owner` 可留空，自动解析为当前 GitHub 用户名，添加成功后自动刷新并补齐元信息。
- **良好交互体验**：统一的确认弹框、可取消的 Loading 弹框、按钮与表格 hover 高亮，让操作状态一目了然。

---

## 前置条件

- Node.js 18+
- 一个 GitHub Personal Access Token：
  - 需要 `repo` 权限。
  - Token 对应账号必须对这些 Fork 仓库有 push 权限。

---

## 本地快速开始（Node.js 版本）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 GitHub Token

在项目根目录创建 `.env` 文件：

```bash
# 必填：GitHub Personal Access Token（需 repo 权限）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# 可选：服务端口，默认 3846
PORT=3846
```

> 生成 Token：  
> GitHub → Settings → Developer settings → Personal access tokens → Generate new token，勾选 `repo`。

### 3. 启动服务

```bash
npm start
```

浏览器访问 `http://localhost:3846`，即可使用页面：

1. 点击「添加仓库」：
   - `Owner` 可留空（默认使用当前 Token 用户名）。
   - 填写 `Repo` 和分支（默认 `main`）。
2. 在列表中：
   - 点击「同步」可对单个仓库执行与上游的合并。
   - 点击「一键批量同步」可依次同步所有仓库。
   - 点击「一键导入所有 Fork 仓库」可自动导入当前账号下所有 Fork 仓库。

---

## 部署到 Cloudflare Workers（可选）

项目提供了一个 `worker.js`，可以将后端迁移到 Cloudflare Workers，无需自建服务器。

### 1）配置 KV 与环境变量

在 Cloudflare Dashboard 或 `wrangler.toml` 中配置：

- KV Namespace（示例）：

```toml
[[kv_namespaces]]
binding = "REPOS_KV"
id = "your-kv-id"
```

- 环境变量：

```toml
[vars]
GITHUB_TOKEN = "你的 GitHub Token"
```

### 2）使用 `worker.js` 作为入口

将 Workers 服务入口指向 `worker.js`，即可提供与本地 `server.js` 等价的后端 API。

### 3）前端接入

- 如果前端和 Workers 同域（例如 Cloudflare Pages + Functions），`public/app.js` 中的 `const API = ''` 保持不变。
- 如果前端在其他域名：
  - 将 `const API` 改成 Workers 的地址前缀，例如：

    ```js
    const API = 'https://your-worker.example.workers.dev';
    ```

---

## 项目结构

```text
.
├── server.js       # 本地 Node 版后端（Express）
├── worker.js       # Cloudflare Workers 版后端（使用 KV 存储）
├── sync.js         # 调用 GitHub merge-upstream API
├── store.js        # 本地 JSON 存储（Node 版本使用）
├── data/
│   └── repos.json  # 持久化的仓库配置（Node 版本自动生成）
├── public/
│   ├── index.html  # 前端页面
│   ├── style.css   # 页面样式
│   └── app.js      # 前端逻辑 & API 调用
├── .env            # 本地环境变量（勿提交）
└── package.json
```

---

## API 概览

| 方法 | 路径 | 说明 | 备注 |
|------|------|------|------|
| `GET` | `/api/repos` | 获取当前配置的所有仓库列表 | 返回本地存储中的仓库数组，用于页面列表展示 |
| `POST` | `/api/repos` | 添加单个仓库 | Body: `{ owner?, repo, branch?, label? }`；`owner` 为空时会用当前 Token 对应 GitHub 用户名；添加后会自动补齐 Fork / 上游的时间与最新 commit 信息 |
| `DELETE` | `/api/repos/:id` | 删除本地列表中的一个仓库 | 仅删除本地配置，不会删除 GitHub 上的仓库，也不会取消 Fork |
| `PATCH` | `/api/repos/:id` | 更新仓库的分支 / 显示名称等信息 | Body: `{ branch?, label? }`，用于修改本地配置 |
| `GET` | `/api/current-user` | 获取当前 `GITHUB_TOKEN` 对应的 GitHub 用户信息 | 返回 `{ ok, login, name }`，前端用来自动填充添加表单的 Owner 输入框 |
| `POST` | `/api/sync/:id` | 同步单个仓库到上游 | 调用 GitHub Merge Upstream API；当分支已是最新或未落后时返回「当前主分支已是最新」提示 |
| `POST` | `/api/sync-all` | 一键批量同步所有已配置仓库 | 依次对所有仓库调用单仓库同步，返回每个仓库的同步结果数组 |
| `POST` | `/api/import-forks` | 一键导入当前账号下所有 Fork 仓库 | 基于当前 Token 调用 `GET /user/repos`，筛选 `fork == true` 的仓库，自动写入本地列表；为本次新增的仓库补齐 Fork / 上游时间和最新 commit 信息 |
| `POST` | `/api/refresh-meta` | 刷新所有仓库的 Fork / 上游元信息 | 为每个仓库刷新 push 时间和最新 commit 信息；遇到 GitHub 已删除或已取消 Fork 的仓库会自动从本地列表移除 |

---

## License

MIT
