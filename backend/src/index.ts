export interface Env {
	GITHUB_REPO: string;
	GITHUB_BRANCH: string;
	GITHUB_TOKEN: string;
	AUTH_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 1. 直连文件访问 (/f/*) 不需要鉴权，方便作为图床链接直接引用
		if (url.pathname.startsWith("/f/")) {
			return await handleRawFile(request, env);
		}

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Secret",
				},
			});
		}

		// 2. 管理操作 (list, upload, delete) 需要鉴权
		const authSecret = request.headers.get("X-Auth-Secret") || url.searchParams.get("secret");
		if (authSecret !== env.AUTH_SECRET) {
			return new Response("未授权", { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
		}

		try {
			if (url.pathname === "/list") {
				return await handleList(request, env);
			} else if (url.pathname === "/upload" && request.method === "POST") {
				return await handleUpload(request, env);
			} else if (url.pathname === "/delete" && request.method === "DELETE") {
				return await handleDelete(request, env);
			}

			return new Response("Not Found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
			});
		}
	},
};

async function handleRawFile(request: Request, env: Env) {
	const url = new URL(request.url);
	const filePath = url.pathname.slice(3); // 去掉 /f/
	const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}?ref=${env.GITHUB_BRANCH}`;

	const response = await fetch(apiUrl, {
		headers: {
			"User-Agent": "Cloudflare-Worker-Image-Host",
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3.raw", // 关键：请求原始二进制内容
		},
	});

	if (!response.ok) {
		return new Response("File Not Found", { status: 404 });
	}

	// 自动识别图片类型
	const contentType = response.headers.get("Content-Type") || "application/octet-stream";
	
	return new Response(response.body, {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=2592000, s-maxage=2592000", // 缓存 30 天
			"Access-Control-Allow-Origin": "*",
		},
	});
}

async function handleList(request: Request, env: Env) {
	const url = new URL(request.url);
	const path = url.searchParams.get("path") || "imgs";
	const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;

	const response = await fetch(apiUrl, {
		headers: {
			"User-Agent": "Cloudflare-Worker-Image-Host",
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3+json",
		},
	});

	if (!response.ok) {
		if (response.status === 404) {
			return new Response(JSON.stringify([]), {
				headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
			});
		}
		const error = await response.json();
		return new Response(JSON.stringify(error), { status: response.status, headers: { "Access-Control-Allow-Origin": "*" } });
	}

	const data: any = await response.json();
	// Filter only images or files
	const files = Array.isArray(data) ? data.map((file: any) => ({
		name: file.name,
		path: file.path,
		sha: file.sha,
		size: file.size,
		type: file.type,
		url: file.type === "file" ? `https://cdn.jsdelivr.net/gh/${env.GITHUB_REPO}@${env.GITHUB_BRANCH}/${file.path}` : null,
	})) : [];

	return new Response(JSON.stringify(files), {
		headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
	});
}

async function handleUpload(request: Request, env: Env) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;
		const path = formData.get("path") as string || "imgs";

		if (!file) {
			return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
		}

		const fileName = file.name;
		// 规范化文件名：移除空格，增加时间戳
		const safeFileName = `${Date.now()}-${fileName.replace(/\s+/g, "-")}`;
		// 路径处理：确保 imgs/filename 这种结构，不重复斜杠
		const cleanPath = path.replace(/\/+$/, "");
		const filePath = `${cleanPath}/${safeFileName}`;
		
		const arrayBuffer = await file.arrayBuffer();
		const base64Content = b64encode(arrayBuffer);

		// GitHub API 路径：只对路径组件进行编码，而不是整个路径
		const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;

		const response = await fetch(apiUrl, {
			method: "PUT",
			headers: {
				"User-Agent": "Cloudflare-Worker-Image-Host",
				Authorization: `Bearer ${env.GITHUB_TOKEN}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: `Upload image: ${safeFileName}`,
				content: base64Content,
				branch: env.GITHUB_BRANCH,
			}),
		});

		const result: any = await response.json();
		if (!response.ok) {
			return new Response(JSON.stringify({ 
				error: result.message || "GitHub API Error", 
				details: result 
			}), { 
				status: response.status, 
				headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
			});
		}

		return new Response(JSON.stringify({
			success: true,
			url: `https://cdn.jsdelivr.net/gh/${env.GITHUB_REPO}@${env.GITHUB_BRANCH}/${filePath}`,
			data: result
		}), {
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: "Internal Server Error", message: err.message }), {
			status: 500,
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	}
}

// 极速版 Base64 编码函数：采用分片处理，规避 Cloudflare Worker 10ms CPU 限制
function b64encode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunk_size = 8192; // 每次处理 8KB，避免栈溢出
	
	for (let i = 0; i < bytes.length; i += chunk_size) {
		const chunk = bytes.subarray(i, i + chunk_size);
		// @ts-ignore
		binary += String.fromCharCode.apply(null, chunk);
	}
	
	return btoa(binary);
}

async function handleDelete(request: Request, env: Env) {
	const url = new URL(request.url);
	const path = url.searchParams.get("path");
	const sha = url.searchParams.get("sha");

	if (!path || !sha) {
		return new Response(JSON.stringify({ error: "Missing path or sha" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
	}

	const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

	const response = await fetch(apiUrl, {
		method: "DELETE",
		headers: {
			"User-Agent": "Cloudflare-Worker-Image-Host",
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: "application/vnd.github.v3+json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message: `Delete image: ${path}`,
			sha: sha,
			branch: env.GITHUB_BRANCH,
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		return new Response(JSON.stringify(error), { status: response.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
	}

	return new Response(JSON.stringify({ success: true }), {
		headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
	});
}

