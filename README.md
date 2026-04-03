# GitHub 图床 - Cloudflare + jsDelivr

这是一个基于 **Cloudflare Workers** + **Cloudflare Pages** 和 **GitHub API** 构建的个人图床。图片存储在 GitHub 仓库中，并通过 **jsDelivr CDN** 提供全球加速访问。

---

## 🚀 快速开始

### 1. GitHub 准备工作 (关键)

1.  **创建仓库**:
    - 在 GitHub 上创建一个新仓库 (例如 `my-images`)。
    - 建议设为 **Public** (jsDelivr 才能访问)，或者在之后将特定文件公开。
    - 记录仓库全名，例如: `yourname/my-images`。
2.  **生成 Token (PAT)**:
    - 进入 GitHub [Settings -> Developer settings -> Personal access tokens -> Tokens (classic)](https://github.com/settings/tokens)。
    - 点击 **Generate new token (classic)**。
    - **Note**: 输入 `image-host`。
    - **Select scopes**: 勾选 `repo` (允许读写仓库内容)。
    - **Generate token**: 复制并保存该 Token (它只会出现一次)。

### 2. 本地开发与运行 (可选)

如果您想在本地运行或测试项目：

#### **后端 (Backend)**
1.  进入目录：`cd backend`
2.  安装依赖：`npm install`
3.  **配置本地变量**：在 `backend` 目录下创建 `.dev.vars` 文件，内容如下：
    ```env
    GITHUB_REPO="yourname/my-images"
    GITHUB_BRANCH="main"
    GITHUB_TOKEN="ghp_xxxxxx"
    AUTH_SECRET="admin123"
    ```
4.  本地运行：`npm run dev` (默认运行在 `http://localhost:8787`)

#### **前端 (Frontend)**
1.  进入目录：`cd frontend`
2.  安装依赖：`npm install`
3.  本地运行：`npm run dev`
4.  访问：打开浏览器访问 `http://localhost:5173`。在设置中填入本地后端地址 `http://localhost:8787` 即可进行本地调试。

---

## 🤖 自动化部署 (GitHub Actions)

项目已配置 GitHub Actions。只需在 GitHub 仓库中配置好以下 Secrets，代码推送至 `main` 分支时将自动部署到 Cloudflare。

### 1. 获取 Cloudflare 凭证
1.  **API Token**: 登录 Cloudflare -> **My Profile** -> **API Tokens** -> **Create Token** -> 使用 **Edit Cloudflare Workers** 模板。
2.  **Account ID**: 登录 Cloudflare -> **Workers & Pages** -> 在右侧栏可以找到 **Account ID**。

### 2. 配置 GitHub Secrets
在 GitHub 仓库中，进入 **Settings -> Secrets and variables -> Actions**，添加以下 **Repository secrets**:

| Secret 名称 | 说明 | 示例 |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | `xxxxxx...` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | `xxxxxx...` |
| `VITE_WORKER_URL` | 前端内置的 Worker 地址 (可选) | `https://your-worker.workers.dev` |
| `GH_REPO` | 你的 GitHub 仓库全名 | `yourname/my-images` |
| `GH_BRANCH` | 存储图片的分支名 | `main` |
| `GH_TOKEN` | 刚才生成的 GitHub PAT | `ghp_xxxxxx...` |
| `AUTH_SECRET` | 自定义的通信密钥 | `admin123` |

### 3. 部署流程
- **后端 (Worker)**: 每次推送 `backend/` 变动，将自动通过 `wrangler` 部署，并将 `GH_` 系列变量自动同步到 Worker 环境变量中。
- **前端 (Pages)**: 每次推送 `frontend/` 变动，将自动构建并发布。**首次部署后，请在 Cloudflare Pages 侧确认项目名称为 `github-image-host-frontend`**。

---

## 🛠️ 如何操作使用

1.  **配置前端**:
    - 第一次打开部署好的 Pages 页面时，点击右上角的 **设置 (⚙️)** 图标。
    - **Worker URL**: 输入部署好的后端地址 (如 `https://github-image-host-backend.yourname.workers.dev`)。
    - **Auth Secret**: 输入您在 GitHub Secrets 中设置的 `AUTH_SECRET`。
    - 点击 **保存配置**。
2.  **上传与管理**:
    - 点击 **上传图片** 或拖拽上传。
    - 鼠标悬停图片可进行 **复制链接 (🔗)** 或 **删除 (🗑️)**。
3.  **链接格式**:
    - `https://cdn.jsdelivr.net/gh/yourname/my-images@main/imgs/filename.jpg`

---

## 📦 技术栈
- **前端**: React, TypeScript, Tailwind CSS, Lucide Icons
- **后端**: Cloudflare Workers
- **存储**: GitHub API
- **CDN**: jsDelivr

## 💡 提示
- **存储目录**: 所有上传的图片将自动存储在仓库的 `imgs/` 文件夹下。
- **缓存说明**: jsDelivr 缓存较强，删除 GitHub 图片后，CDN 链接可能仍会生效一段时间。
- **限制**: 建议单张图片不超过 5MB 以符合 GitHub API 最佳实践。
