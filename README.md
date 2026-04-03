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

### 2. 部署后端 (Cloudflare Worker)

后端负责与 GitHub API 安全交互，并处理图片上传/列表/删除。

1.  **本地安装**:
    - 进入 `backend` 目录。
    - 运行 `npm install` 安装依赖。
2.  **部署到 Cloudflare**:
    - 运行 `npm run deploy`。
    - 首次运行会要求你登录 Cloudflare 账号。
    - 部署成功后，你会得到一个 URL (例如 `https://github-image-host-backend.yourname.workers.dev`)。
3.  **配置环境变量 (必须)**:
    - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
    - 进入 **Workers & Pages** -> 点击你的 Worker 项目 (`github-image-host-backend`)。
    - 点击 **Settings** (设置) -> **Variables** (变量)。
    - 在 **Environment Variables** 中点击 **Add variable**，添加以下 4 个变量：
      - `GITHUB_REPO`: 你的仓库全名 (如 `yourname/my-images`)。
      - `GITHUB_BRANCH`: 分支名 (通常是 `main`)。
      - `GITHUB_TOKEN`: 刚才生成的 GitHub Token。
      - `AUTH_SECRET`: **自定义一个密钥** (例如 `mysecret123`)，用于前端和后端通信。
    - 点击 **Save and deploy**。

### 3. 部署前端 (Cloudflare Pages)

前端提供可视化的图片管理和上传界面。

1.  **本地构建**:
    - 进入 `frontend` 目录。
    - 运行 `npm install`。
    - 运行 `npm run build`。构建完成后会生成 `dist` 文件夹。
2.  **在 Cloudflare Pages 部署**:
    - 方式 A (手动): 在 Cloudflare Dashboard 进入 **Workers & Pages** -> **Create** -> **Pages** -> **Upload assets**，将 `dist` 文件夹拖进去。
    - 方式 B (连接 GitHub): 连接你的前端代码仓库，配置如下：
      - **Framework preset**: `Vite`
      - **Build command**: `npm run build`
      - **Build output directory**: `dist`
3.  **访问前端**: 部署成功后访问 Cloudflare 提供的 `.pages.dev` 域名。

---

## 🤖 自动化部署 (GitHub Actions)

项目已配置 GitHub Actions 自动部署。当你推送代码到 `main` 分支时，后端 Worker 和前端 Pages 会自动更新。

### 1. 配置 GitHub Secrets
在 GitHub 仓库中，进入 **Settings -> Secrets and variables -> Actions**，添加以下 **Repository secrets**:

- `CLOUDFLARE_API_TOKEN`: 你的 Cloudflare API Token (需要 `Cloudflare Workers` 和 `Cloudflare Pages` 的编辑权限)。
- `CLOUDFLARE_ACCOUNT_ID`: 你的 Cloudflare 账户 ID (在 Dashboard 的 Workers 页面右侧可以找到)。

### 2. 部署流程
- **后端**: 每次推送 `backend/` 目录下的更改，`.github/workflows/backend-deploy.yml` 会触发，使用 `wrangler deploy` 自动部署。
- **前端**: 每次推送 `frontend/` 目录下的更改，`.github/workflows/frontend-deploy.yml` 会触发，构建并发布到 Cloudflare Pages。

---


1.  **配置前端**:
    - 第一次打开页面时，界面会提示配置。
    - 点击右上角的 **设置 (⚙️)** 图标。
    - **Worker URL**: 输入你部署好的后端 Worker 地址 (如 `https://xxx.workers.dev`)。
    - **Auth Secret**: 输入你刚才在 Worker 变量中设置的 `AUTH_SECRET`。
    - 点击 **保存配置**。
2.  **上传图片**:
    - 点击 **上传图片** 按钮或拖拽图片。
    - 上传成功后，图片会自动出现在列表中。
3.  **获取链接**:
    - 鼠标悬停在图片上，点击 **复制 (🔗)** 图标。
    - 链接格式为: `https://cdn.jsdelivr.net/gh/yourname/my-images@main/filename.jpg`。
4.  **删除管理**:
    - 悬停在图片上，点击 **删除 (🗑️)** 图标。

---

## 📦 技术栈
- **前端**: React, TypeScript, Tailwind CSS, Lucide Icons
- **后端**: Cloudflare Workers (Hono-like style)
- **存储**: GitHub API
- **CDN**: jsDelivr

## 💡 提示
- jsDelivr 缓存较强，删除 GitHub 上的图片后，CDN 链接可能还会生效一段时间。
- 如果上传大图失败，请检查 GitHub API 的限制（通常建议图片不超过 5MB）。
