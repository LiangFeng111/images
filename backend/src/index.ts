export interface Env {
	GITHUB_REPO: string;
	GITHUB_BRANCH: string;
	GITHUB_TOKEN: string;
	AUTH_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

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

		// Simple Auth check
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
	const formData = await request.formData();
	const file = formData.get("file") as File;
	const path = formData.get("path") as string || "imgs";

	if (!file) {
		return new Response("No file uploaded", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
	}

	const fileName = file.name;
	// 为文件名增加时间戳前缀，避免冲突
	const safeFileName = `${Date.now()}-${fileName.replace(/\s+/g, "-")}`;
	const filePath = path.endsWith("/") ? `${path}${safeFileName}` : `${path}/${safeFileName}`;
	const arrayBuffer = await file.arrayBuffer();
	const base64Content = b64encode(arrayBuffer);

	const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;

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
		const errorMessage = result.message || "Unknown error from GitHub API";
		return new Response(JSON.stringify({ error: errorMessage, details: result }), { 
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
}

async function handleDelete(request: Request, env: Env) {
	const url = new URL(request.url);
	const path = url.searchParams.get("path");
	const sha = url.searchParams.get("sha");

	if (!path || !sha) {
		return new Response("Missing path or sha", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
	}

	const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;

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
		return new Response(JSON.stringify(error), { status: response.status, headers: { "Access-Control-Allow-Origin": "*" } });
	}

	return new Response(JSON.stringify({ success: true }), {
		headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
	});
}

// Helper to encode ArrayBuffer to Base64
function b64encode(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
