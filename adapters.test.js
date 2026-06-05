import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
	buildSuperlearnerUrl,
	parseServerEventLine,
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
