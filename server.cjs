const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const token = crypto.randomBytes(16).toString("hex");
const idleTimeoutMs = Number.parseInt(process.env.SUPERMENTOR_IDLE_TIMEOUT_MS || "3600000", 10);
const ackTimeoutMs = Number.parseInt(process.env.SUPERMENTOR_ACK_TIMEOUT_MS || "15000", 10);
const submitBodyLimit = 128 * 1024;
const staticAssetCache = new Map();
const pendingAcks = new Map();
let lastActivityAt = Date.now();
let shutdownRequested = false;
let server;

function touchActivity() {
	lastActivityAt = Date.now();
}

function cacheRootFor(env = process.env, platform = process.platform, home = os.homedir()) {
	if (env.SUPERMENTOR_CACHE_DIR) return env.SUPERMENTOR_CACHE_DIR;
	if (env.XDG_CACHE_HOME) return path.join(env.XDG_CACHE_HOME, "supermentor");
	if (platform === "darwin") return path.join(home, "Library", "Caches", "supermentor");
	if (platform === "win32") return path.join(env.LOCALAPPDATA || env.APPDATA || path.join(home, "AppData", "Local"), "supermentor");
	return path.join(home, ".cache", "supermentor");
}

function cacheRoot() {
	return cacheRootFor();
}

function slug(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function createSessionId() {
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
	return `sm_${stamp}_${crypto.randomBytes(4).toString("hex")}`;
}

const sessionId = slug(process.env.SUPERMENTOR_SESSION_ID) || createSessionId();
const sessionDir = path.resolve(process.env.SUPERMENTOR_SESSION_DIR || path.join(cacheRoot(), "sessions", sessionId));
const threadsDir = path.join(sessionDir, "threads");
const contentDir = path.join(sessionDir, "content");
const eventsFile = path.join(sessionDir, "events.jsonl");
const lessonFile = path.join(sessionDir, "lesson.json");
const manifestFile = path.join(sessionDir, "session.json");

function ensureSessionStore() {
	fs.mkdirSync(threadsDir, { recursive: true });
	fs.mkdirSync(contentDir, { recursive: true });
	if (!fs.existsSync(manifestFile)) {
		writeJson(manifestFile, {
			sessionId,
			createdAt: new Date().toISOString(),
			cwd: process.env.SUPERMENTOR_CWD || process.cwd(),
			title: process.env.SUPERMENTOR_TITLE || "Supermentor session",
			kind: "learning-session",
		});
	}
	if (!fs.existsSync(lessonFile)) {
		writeJson(lessonFile, defaultLesson());
	}
}

function defaultLesson() {
	return {
		kind: "learning-document",
		version: 1,
		sessionId,
		title: process.env.SUPERMENTOR_TITLE || "Supermentor",
		intro:
			"Ton espace d’apprentissage interactif est prêt. Demande à l’agent de publier une leçon, un walkthrough de code, un exercice ou un parcours guidé ici.",
		blocks: [
			{
				id: "welcome",
				type: "concept",
				title: "Comment utiliser cet espace",
				body:
					"Tu peux commenter une section ou une sélection précise. La question repartira vers l’agent avec le contexte général, mais la réponse sera rendue ici sous le passage concerné.",
			},
		],
	};
}

function readJson(filePath, fallback = null) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return fallback;
	}
}

function writeJson(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function appendEvent(event) {
	fs.appendFileSync(eventsFile, `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`);
}

function readCachedText(filePath) {
	const cached = staticAssetCache.get(filePath);
	const stat = fs.statSync(filePath);
	if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.text;
	const text = fs.readFileSync(filePath, "utf8");
	staticAssetCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, text });
	return text;
}

function parseRequestUrl(req) {
	return new URL(req.url, "http://127.0.0.1");
}

function rejectInvalidToken(req, res) {
	if (req.headers["x-supermentor-token"] === token) return false;
	res.writeHead(403, { "content-type": "application/json" });
	res.end(JSON.stringify({ error: "invalid token" }));
	return true;
}

function readBody(req, limit) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > limit) {
				reject(new Error(`request body exceeds ${limit} bytes`));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

async function readJsonBody(req) {
	const body = await readBody(req, submitBodyLimit);
	if (!body.trim()) return {};
	try {
		return JSON.parse(body);
	} catch {
		const error = new Error("invalid JSON body");
		error.statusCode = 400;
		throw error;
	}
}

function sendJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

function serveText(res, contentType, text) {
	res.writeHead(200, { "content-type": contentType });
	res.end(text);
}

function escapeBootstrapJson(value) {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

function loadBootstrap() {
	const manifest = readJson(manifestFile, {});
	return {
		...manifest,
		sessionId,
		sessionDir,
		token,
	};
}

function readThread(threadId) {
	const safeId = slug(threadId);
	if (!safeId) return null;
	const dir = path.join(threadsDir, safeId);
	const question = readJson(path.join(dir, "question.json"));
	const reply = readJson(path.join(dir, "reply.json"));
	return question ? { threadId: safeId, question, reply } : null;
}

function listThreads() {
	if (!fs.existsSync(threadsDir)) return [];
	return fs
		.readdirSync(threadsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => readThread(entry.name))
		.filter(Boolean)
		.sort((left, right) => String(left.question.createdAt).localeCompare(String(right.question.createdAt)));
}

function createInlineQuestion(payload) {
	const threadId = slug(payload.threadId) || `thr_${crypto.randomBytes(6).toString("hex")}`;
	const requestId = `req_${crypto.randomBytes(6).toString("hex")}`;
	const threadDir = path.join(threadsDir, threadId);
	const questionPath = path.join(threadDir, "question.json");
	const replyPath = path.join(threadDir, "reply.json");
	const question = {
		type: "inline_question",
		requestId,
		threadId,
		sessionId,
		lessonId: payload.lessonId || null,
		blockId: payload.blockId || payload.anchor?.blockId || null,
		anchor: payload.anchor || null,
		selection: String(payload.selection || "").slice(0, 12000),
		question: String(payload.question || "").trim(),
		createdAt: new Date().toISOString(),
		paths: { questionPath, replyPath },
	};
	if (!question.question) {
		const error = new Error("question is required");
		error.statusCode = 400;
		throw error;
	}
	writeJson(questionPath, question);
	appendEvent({ type: "inline-question-created", requestId, threadId, blockId: question.blockId });
	return { requestId, threadId, threadDir, question, questionPath, replyPath };
}

function removeThread(created, reason) {
	try {
		fs.rmSync(created.threadDir, { recursive: true, force: true });
	} catch {}
	appendEvent({ type: "inline-question-removed", requestId: created.requestId, threadId: created.threadId, reason });
}

function registerAck(requestId) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			pendingAcks.delete(requestId);
			reject(new Error(`supermentor launcher ack timeout after ${ackTimeoutMs}ms`));
		}, ackTimeoutMs);
		pendingAcks.set(requestId, { resolve, reject, timeout });
	});
}

function settleAck(event) {
	const pending = pendingAcks.get(event.requestId);
	if (!pending) return false;
	pendingAcks.delete(event.requestId);
	clearTimeout(pending.timeout);
	pending.resolve(event);
	return true;
}

function closeServer(reason = "shutdown") {
	if (shutdownRequested) return;
	shutdownRequested = true;
	appendEvent({ type: "server-stopped", reason });
	if (server) server.close(() => process.exit(0));
	else process.exit(0);
}

async function handleApi(req, res, url) {
	if (rejectInvalidToken(req, res)) return;

	if (req.method === "GET" && url.pathname === "/api/session") {
		sendJson(res, 200, { manifest: readJson(manifestFile, {}), lesson: readJson(lessonFile, defaultLesson()), threads: listThreads() });
		return;
	}
	if (req.method === "GET" && url.pathname === "/api/lesson") {
		sendJson(res, 200, readJson(lessonFile, defaultLesson()));
		return;
	}
	if (req.method === "POST" && url.pathname === "/api/inline-question") {
		const payload = await readJsonBody(req);
		const created = createInlineQuestion(payload);
		const ackPromise = registerAck(created.requestId);
		const event = {
			type: "inline-question",
			requestId: created.requestId,
			payload: {
				...created.question,
				instruction: `Read ${created.questionPath}. Write the answer JSON to ${created.replyPath}. Keep the main chat compact after writing the file.`,
			},
		};
		try {
			process.stdout.write(`${JSON.stringify(event)}\n`);
		} catch (error) {
			removeThread(created, "stdout write failed");
			sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "inline question delivery failed", requestId: created.requestId });
			return;
		}

		let ack;
		try {
			ack = await ackPromise;
		} catch (error) {
			removeThread(created, "ack timeout");
			sendJson(res, 504, {
				ok: false,
				error: error instanceof Error ? error.message : "inline question delivery timed out",
				requestId: created.requestId,
				threadId: created.threadId,
			});
			return;
		}

		if (!ack.ok) {
			removeThread(created, "ack failed");
			sendJson(res, 502, { ok: false, error: ack.error || "inline question delivery failed", requestId: created.requestId, threadId: created.threadId });
			return;
		}

		sendJson(res, 202, { ok: true, delivered: true, message: ack.message, requestId: created.requestId, threadId: created.threadId, replyPath: created.replyPath });
		return;
	}
	const threadMatch = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
	if (req.method === "GET" && threadMatch) {
		const thread = readThread(threadMatch[1]);
		if (!thread) sendJson(res, 404, { error: "thread not found" });
		else sendJson(res, 200, thread);
		return;
	}
	if (req.method === "POST" && url.pathname === "/api/shutdown") {
		sendJson(res, 200, { ok: true });
		setTimeout(() => closeServer("browser request"), 25).unref();
		return;
	}

	sendJson(res, 404, { error: "not found" });
}

function handleRequest(req, res) {
	touchActivity();
	const url = parseRequestUrl(req);
	handleRequestAsync(req, res, url).catch((error) => {
		const statusCode = Number(error?.statusCode) || 500;
		sendJson(res, statusCode, { error: error instanceof Error ? error.message : "internal error" });
	});
}

async function handleRequestAsync(req, res, url) {
	if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
	if (req.method === "GET" && url.pathname === "/") {
		const template = readCachedText(path.join(__dirname, "mentor-template.html"));
		serveText(res, "text/html; charset=utf-8", template.replace("{{BOOTSTRAP_JSON}}", escapeBootstrapJson(loadBootstrap())));
		return;
	}
	const staticFiles = new Map([
		["/mentor-client.js", ["application/javascript; charset=utf-8", "mentor-client.js"]],
		["/mentor-styles.css", ["text/css; charset=utf-8", "mentor-styles.css"]],
		["/mentor-theme.js", ["application/javascript; charset=utf-8", "mentor-theme.js"]],
		["/assets/highlight.min.js", ["application/javascript; charset=utf-8", path.join("assets", "highlight.min.js")]],
		["/assets/highlight-github-dark.min.css", ["text/css; charset=utf-8", path.join("assets", "highlight-github-dark.min.css")]],
		["/assets/highlight-github-light.min.css", ["text/css; charset=utf-8", path.join("assets", "highlight-github-light.min.css")]],
		["/assets/icons/theme.svg", ["image/svg+xml; charset=utf-8", path.join("assets", "icons", "theme.svg")]],
		["/assets/icons/refresh.svg", ["image/svg+xml; charset=utf-8", path.join("assets", "icons", "refresh.svg")]],
		["/assets/icons/comment.svg", ["image/svg+xml; charset=utf-8", path.join("assets", "icons", "comment.svg")]],
	]);
	if (req.method === "GET" && staticFiles.has(url.pathname)) {
		const [contentType, fileName] = staticFiles.get(url.pathname);
		serveText(res, contentType, readCachedText(path.join(__dirname, fileName)));
		return;
	}
	res.writeHead(404);
	res.end("Not found");
}

let submissionReader = null;

function startSubmissionReader() {
	if (submissionReader) return;
	submissionReader = readline.createInterface({ input: process.stdin });
	submissionReader.on("line", (line) => {
		let event;
		try {
			event = JSON.parse(line);
		} catch {
			return;
		}
		if (event?.type === "supermentor-ack" && event.requestId) settleAck(event);
	});
	submissionReader.on("close", () => {
		for (const [requestId, pending] of pendingAcks) {
			clearTimeout(pending.timeout);
			pending.reject(new Error("supermentor launcher closed before acknowledging"));
			pendingAcks.delete(requestId);
		}
	});
}

function requireLoopbackHost(host) {
	const allowed = new Set(["127.0.0.1", "::1"]);
	if (allowed.has(host)) return host;
	process.stderr.write(`SUPERMENTOR_HOST must be loopback-only (127.0.0.1 or ::1), got: ${host}\n`);
	process.exit(1);
}

function formatUrlHost(host) {
	return host === "::1" ? "[::1]" : host;
}

function startServer() {
	ensureSessionStore();
	startSubmissionReader();
	server = http.createServer(handleRequest);
	const host = requireLoopbackHost(process.env.SUPERMENTOR_HOST || "127.0.0.1");
	const port = Number.parseInt(process.env.SUPERMENTOR_PORT || "0", 10);
	const lifecycleCheck = setInterval(() => {
		if (Date.now() - lastActivityAt > idleTimeoutMs) closeServer("idle timeout");
	}, 60 * 1000);
	lifecycleCheck.unref();
	server.listen(port, host, () => {
		const address = server.address();
		const actualPort = typeof address === "object" && address ? address.port : port;
		const url = `http://${formatUrlHost(host)}:${actualPort}/`;
		const started = { type: "server-started", port: actualPort, host, url, token, sessionId, sessionDir };
		writeJson(path.join(sessionDir, "server.json"), started);
		appendEvent({ type: "server-started", port: actualPort, host, url });
		process.stdout.write(`${JSON.stringify(started)}\n`);
	});
}

if (require.main === module) startServer();

module.exports = { cacheRoot, cacheRootFor, createSessionId, startServer };
