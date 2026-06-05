import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	buildSuperlearnerUrl,
	parseServerEventLine,
	spawnSuperlearnerServer,
	waitForServerStarted,
	writeSuperlearnerAck,
} from "./client-shared.js";
import {
	buildOpencodeSuperlearnerUrl,
	opencodeSuperlearnerServerOptions,
	writeOpencodeSuperlearnerAck,
} from "./opencode.js";
import {
	buildPiSuperlearnerUrl,
	piSuperlearnerServerOptions,
	writePiSuperlearnerAck,
} from "./pi.js";
import { formatInlineQuestionPrompt } from "./learner-prompt.js";

async function startTestServer(env = {}) {
	const cache = fs.mkdtempSync(path.join(os.tmpdir(), "superlearner-test-"));
	const child = spawnSuperlearnerServer({
		cwd: process.cwd(),
		env: {
			SUPERLEARNER_CACHE_DIR: cache,
			SUPERLEARNER_ACK_TIMEOUT_MS: "100",
			...env,
		},
	});
	const started = await waitForServerStarted(child);
	return {
		child,
		started,
		cache,
		async close() {
			if (!child.killed) child.kill();
			fs.rmSync(cache, { recursive: true, force: true });
		},
	};
}

async function readJsonResponse(response) {
	return { status: response.status, body: await response.json() };
}

function waitForInlineEvent(child) {
	return new Promise((resolve, reject) => {
		let buffer = "";
		const onData = (chunk) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) {
				const event = parseServerEventLine(line.trim());
				if (event?.type === "inline-question") {
					child.stdout.off("data", onData);
					resolve(event);
					return;
				}
			}
		};
		child.stdout.on("data", onData);
		setTimeout(() => {
			child.stdout.off("data", onData);
			reject(new Error("inline event timeout"));
		}, 1000).unref();
	});
}

test("shared URL builder preserves existing URL and adds params", () => {
	const url = buildSuperlearnerUrl(
		{ port: 4321, url: "http://127.0.0.1:4321/?seed=1" },
		{ context: "sl_123", empty: "" },
	);
	assert.equal(url, "http://127.0.0.1:4321/?seed=1&context=sl_123");
});

test("Pi URL includes context without adding OpenCode session param", () => {
	const url = buildPiSuperlearnerUrl(
		{ type: "server-started", port: 4321, host: "127.0.0.1", url: "http://127.0.0.1:4321/", token: "tok", sessionId: "sl_123", sessionDir: "/tmp/sl" },
		{ sessionID: "pi-session" },
	);
	assert.equal(url, "http://127.0.0.1:4321/?context=pi-session");
});

test("OpenCode URL includes session param", () => {
	const url = buildOpencodeSuperlearnerUrl(
		{ type: "server-started", port: 4321, host: "127.0.0.1", url: "http://127.0.0.1:4321/", token: "tok", sessionId: "sl_123", sessionDir: "/tmp/sl" },
		{ sessionID: "ses_123" },
	);
	assert.equal(url, "http://127.0.0.1:4321/?session=ses_123");
});

test("adapter server options set superlearner environment", () => {
	const pi = piSuperlearnerServerOptions({ cwd: "/tmp/repo", sessionID: "pi-session", title: "Pi lesson" });
	assert.equal(pi.cwd, "/tmp/repo");
	assert.deepEqual(pi.stdio, ["pipe", "pipe", "pipe"]);
	assert.equal(pi.env.SUPERLEARNER_CWD, "/tmp/repo");
	assert.equal(pi.env.SUPERLEARNER_SESSION_ID, "pi-session");
	assert.equal(pi.env.SUPERLEARNER_TITLE, "Pi lesson");

	const opencode = opencodeSuperlearnerServerOptions({ cwd: "/tmp/repo", sessionID: "ses_123", cacheDir: "/tmp/cache" });
	assert.equal(opencode.env.SUPERLEARNER_SESSION_ID, "ses_123");
	assert.equal(opencode.env.SUPERLEARNER_CACHE_DIR, "/tmp/cache");
});

test("ack helpers write the shared superlearner-ack payload", () => {
	const writes = [];
	const child = { stdin: { destroyed: false, write: (text) => writes.push(text) } };
	writeSuperlearnerAck(child, "req-shared", { ok: true, message: "ok" });
	writePiSuperlearnerAck(child, "req-pi", { ok: false, error: "pi failed" });
	writeOpencodeSuperlearnerAck(child, "req-open", { ok: true, message: "sent" });
	assert.deepEqual(writes, [
		'{"type":"superlearner-ack","requestId":"req-shared","ok":true,"message":"ok"}\n',
		'{"type":"superlearner-ack","requestId":"req-pi","ok":false,"error":"pi failed"}\n',
		'{"type":"superlearner-ack","requestId":"req-open","ok":true,"message":"sent"}\n',
	]);
});

test("waitForServerStarted resolves after split startup chunks", async () => {
	const child = new EventEmitter();
	child.stdout = new EventEmitter();
	const started = waitForServerStarted(child);
	child.stdout.emit("data", Buffer.from('noise\n{"type":"server-'));
	child.stdout.emit("data", Buffer.from('started","port":4321,"url":"http://127.0.0.1:4321/","token":"tok","sessionId":"sl","sessionDir":"/tmp/sl"}\n'));
	const result = await Promise.race([started, new Promise((resolve) => setTimeout(() => resolve("timed out"), 50))]);
	assert.notEqual(result, "timed out");
	assert.equal(result.type, "server-started");
	assert.equal(result.sessionId, "sl");
});

test("server event parser ignores invalid JSON", () => {
	assert.equal(parseServerEventLine("not json"), null);
	assert.deepEqual(parseServerEventLine('{"type":"x"}'), { type: "x" });
});

test("inline question prompt points the agent at question and reply files", () => {
	const prompt = formatInlineQuestionPrompt({
		threadId: "thr_1",
		blockId: "loop",
		question: "Pourquoi cette boucle ?",
		selection: "for (;;) {}",
		paths: { questionPath: "/tmp/q.json", replyPath: "/tmp/r.json" },
	});
	assert.match(prompt, /Superlearner inline question/);
	assert.match(prompt, /Read question JSON: \/tmp\/q\.json/);
	assert.match(prompt, /Write reply JSON: \/tmp\/r\.json/);
	assert.match(prompt, /Réponse envoyée au commentaire thr_1/);
});

test("server rejects non-loopback hosts", async () => {
	const child = spawn(process.execPath, ["server.cjs"], {
		cwd: process.cwd(),
		env: { ...process.env, SUPERLEARNER_HOST: "0.0.0.0" },
		stdio: ["ignore", "ignore", "pipe"],
	});
	let stderr = "";
	child.stderr.on("data", (chunk) => {
		stderr += chunk.toString();
	});
	const code = await new Promise((resolve) => child.once("exit", resolve));
	assert.equal(code, 1);
	assert.match(stderr, /loopback-only/);
});

test("server rejects API requests without the bootstrap token", async () => {
	const server = await startTestServer();
	try {
		const result = await readJsonResponse(await fetch(`${server.started.url}api/session`));
		assert.equal(result.status, 403);
		assert.equal(result.body.error, "invalid token");
	} finally {
		await server.close();
	}
});

test("server reports malformed JSON as a bad request", async () => {
	const server = await startTestServer();
	try {
		const result = await readJsonResponse(await fetch(`${server.started.url}api/inline-question`, {
			method: "POST",
			headers: { "x-superlearner-token": server.started.token, "content-type": "application/json" },
			body: "{not json",
		}));
		assert.equal(result.status, 400);
		assert.equal(result.body.error, "invalid JSON body");
	} finally {
		await server.close();
	}
});

test("inline question timeout returns 504 and removes the failed thread", async () => {
	const server = await startTestServer();
	try {
		const result = await readJsonResponse(await fetch(`${server.started.url}api/inline-question`, {
			method: "POST",
			headers: { "x-superlearner-token": server.started.token, "content-type": "application/json" },
			body: JSON.stringify({ blockId: "welcome", question: "Pourquoi ?" }),
		}));
		assert.equal(result.status, 504);
		const session = await fetch(`${server.started.url}api/session`, { headers: { "x-superlearner-token": server.started.token } }).then((response) => response.json());
		assert.equal(session.threads.length, 0);
	} finally {
		await server.close();
	}
});

test("inline question failed ack returns 502 and removes the failed thread", async () => {
	const server = await startTestServer();
	try {
		const submitted = fetch(`${server.started.url}api/inline-question`, {
			method: "POST",
			headers: { "x-superlearner-token": server.started.token, "content-type": "application/json" },
			body: JSON.stringify({ blockId: "welcome", question: "Pourquoi ?" }),
		});
		const event = await waitForInlineEvent(server.child);
		server.child.stdin.write(`${JSON.stringify({ type: "superlearner-ack", requestId: event.requestId, ok: false, error: "not delivered" })}\n`);
		const result = await readJsonResponse(await submitted);
		assert.equal(result.status, 502);
		assert.equal(result.body.error, "not delivered");
		const session = await fetch(`${server.started.url}api/session`, { headers: { "x-superlearner-token": server.started.token } }).then((response) => response.json());
		assert.equal(session.threads.length, 0);
	} finally {
		await server.close();
	}
});

test("thread endpoint returns 404 for unknown thread", async () => {
	const server = await startTestServer();
	try {
		const result = await readJsonResponse(await fetch(`${server.started.url}api/threads/missing`, { headers: { "x-superlearner-token": server.started.token } }));
		assert.equal(result.status, 404);
		assert.equal(result.body.error, "thread not found");
	} finally {
		await server.close();
	}
});

test("shutdown endpoint returns ok", async () => {
	const server = await startTestServer();
	try {
		const result = await readJsonResponse(await fetch(`${server.started.url}api/shutdown`, {
			method: "POST",
			headers: { "x-superlearner-token": server.started.token },
		}));
		assert.equal(result.status, 200);
		assert.equal(result.body.ok, true);
	} finally {
		await server.close();
	}
});
