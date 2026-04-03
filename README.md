# GitHub 图床 - Cloudflare + GitHub API

这是一个基于 **Cloudflare Workers** + **Cloudflare Pages** 和 **GitHub API** 构建的高性能个人图床。图片存储在您的 GitHub 仓库中，并通过 Cloudflare 全球边缘节点进行加速分发。

---

## 🚀 快速开始

### 1. GitHub 准备工作 (关键)

1.  **创建仓库**:
    - 在 GitHub 上创建一个新仓库 (例如 `my-images`)。建议设为 **Public**，或者在之后通过 Token 访问。
    - 记录仓库全名，例如: `yourname/my-images`。
2.  **生成 Token (PAT)**:
    - 进入 GitHub [Settings -> Developer settings -> Personal access tokens -> Tokens (classic)](https://github.com/settings/tokens)。
    - 点击 **Generate new token (classic)**，勾选 `repo` 权限。
    - **生成并保存 Token** (它只会出现一次)。

### 2. 配置项目参数 (config.json)

在项目根目录下的 `config.json` 中填入您的非敏感信息。

```json
{
  "GITHUB_REPO": "您的用户名/仓库名",
  "GITHUB_BRANCH": "main",
  "WORKER_URL": "您的 Cloudflare Worker 地址 (部署后填入)",
  "DEFAULT_CDN": "Cloudflare"
}
```

---

## 🤖 自动化部署 (GitHub Actions)

项目已配置全自动部署。只需在 GitHub 仓库中配置好以下 Secrets，代码推送至 `main` 分支时将自动完成一切工作。

### 1. 配置 GitHub Secrets
在 GitHub 仓库中，进入 **Settings -> Secrets and variables -> Actions**，添加以下 **Repository secrets**:

| Secret 名称 | 说明 | 示例 |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | `xxxxxx...` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | `xxxxxx...` |
| `GH_TOKEN` | 刚才生成的 GitHub PAT | `ghp_xxxxxx...` |
| `AUTH_SECRET` | 自定义的后台管理密钥 | `admin123` |

### 2. 部署流程
- **后端 (Worker)**: 推送 `backend/` 变动，自动部署并同步变量。
- **前端 (Pages)**: 推送 `frontend/` 变动，自动创建项目并发布。

---

## 🛠️ 如何操作使用

1.  **访问前端**: 访问部署好的 Cloudflare Pages 域名。
2.  **初始配置**:
    - 首次打开，点击右上角 **设置 (⚙️)**。
    - **Worker URL**: 确认已自动填入 (或手动填入您的 Worker 地址)。
    - **Auth Secret**: 输入您在 GitHub Secrets 中设置的 `AUTH_SECRET`。
3.  **上传与 CDN 切换**:
    - 支持 **Cloudflare** (推荐)、**jsDelivr**、**GitHub** 三种链接模式。
    - 切换顶部的 CDN 按钮，下方的预览和“复制链接”会自动同步。

---

## 📦 技术栈
- **前端**: React + Tailwind CSS (部署在 Cloudflare Pages)
- **后端**: Cloudflare Workers (处理上传、列表、删除及图片代理)
- **存储**: GitHub Repository
- **加速**: Cloudflare 全球边缘缓存 (30 天有效)

## 💡 提示
- **全自动**: 第一次部署前端时，Actions 会尝试为您自动在 Cloudflare 创建 Pages 项目。
- **直连访问**: 链接格式为 `Worker地址/f/imgs/文件名.jpg`，该链接无需鉴权，可直接在网页引用。
- **性能**: Cloudflare 代理模式自带边缘缓存，图片一旦被访问，全球加载速度极快。
