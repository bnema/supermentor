import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	buildOpenCodeReviewUrl,
	openCodeReviewServerOptions,
	resolveBaseRef as resolveOpenCodeBaseRef,
	waitForServerStarted as waitForOpenCodeServerStarted,
	writeOpenCodeReviewAck,
} from "./opencode.js";
import {
	buildPiReviewUrl,
	piReviewServerOptions,
	resolveBaseRef as resolvePiBaseRef,
	writePiReviewAck,
} from "./pi.js";

function git(cwd, args) {
	execFileSync("git", args, { cwd, stdio: "ignore" });
}

function createRepo() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "local-pr-review-adapter-"));
	git(dir, ["init", "-b", "main"]);
	git(dir, ["config", "user.email", "test@example.com"]);
	git(dir, ["config", "user.name", "Test User"]);
	fs.writeFileSync(path.join(dir, "file.txt"), "base\n");
	git(dir, ["add", "file.txt"]);
	git(dir, ["commit", "-m", "base"]);
	return dir;
}

test("OpenCode review URL includes context, session, and base", () => {
	const url = buildOpenCodeReviewUrl(
		{ port: 4321, url: "http://127.0.0.1:4321/?context=seed" },
		{ sessionID: "ses_123", baseRef: "main" },
	);

	assert.equal(
		url,
		"http://127.0.0.1:4321/?context=ses_123&session=ses_123&base=main",
	);
});

test("Pi review URL includes context and base without adding session", () => {
	const url = buildPiReviewUrl(
		{ port: 4321, url: "http://127.0.0.1:4321/?context=seed" },
		{ sessionID: "ses_123", baseRef: "main" },
	);

	assert.equal(url, "http://127.0.0.1:4321/?context=ses_123&base=main");
});

test("OpenCode review server options set the OpenCode environment", () => {
	const options = openCodeReviewServerOptions({
		cwd: "/tmp/repo",
		sessionID: "ses_123",
		baseRef: "origin/main",
	});

	assert.equal(options.cwd, "/tmp/repo");
	assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
	assert.equal(options.env.LOCAL_PR_REVIEW_REPO, "/tmp/repo");
	assert.equal(options.env.LOCAL_PR_REVIEW_BASE, "origin/main");
	assert.equal(options.env.LOCAL_PR_REVIEW_CONTEXT_ID, "ses_123");
});

test("Pi review server options set the Pi environment", () => {
	const options = piReviewServerOptions({
		cwd: "/tmp/repo",
		sessionID: "pi-session",
		baseRef: "main",
	});

	assert.equal(options.cwd, "/tmp/repo");
	assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
	assert.equal(options.env.LOCAL_PR_REVIEW_REPO, "/tmp/repo");
	assert.equal(options.env.LOCAL_PR_REVIEW_BASE, "main");
	assert.equal(options.env.LOCAL_PR_REVIEW_CONTEXT_ID, "pi-session");
});

test("adapter server options resolve a default base ref when none is provided", () => {
	const cwd = createRepo();

	const openCode = openCodeReviewServerOptions({
		cwd,
		sessionID: "ses_123",
	});
	const pi = piReviewServerOptions({
		cwd,
		sessionID: "pi-session",
	});

	assert.equal(openCode.env.LOCAL_PR_REVIEW_BASE, "main");
	assert.equal(pi.env.LOCAL_PR_REVIEW_BASE, "main");
});

test("adapter ack helpers write the shared review-ack payload", () => {
	const writes = [];
	const child = {
		stdin: {
			destroyed: false,
			write(text) {
				writes.push(text);
			},
		},
	};

	writeOpenCodeReviewAck(child, "req-open", {
		ok: true,
		message: "Review delivered to OpenCode session",
	});
	writePiReviewAck(child, "req-pi", {
		ok: false,
		error: "pi handoff failed",
	});

	assert.deepEqual(writes, [
		'{"type":"review-ack","requestId":"req-open","ok":true,"message":"Review delivered to OpenCode session"}\n',
		'{"type":"review-ack","requestId":"req-pi","ok":false,"error":"pi handoff failed"}\n',
	]);
});

test("waitForServerStarted resolves after split startup chunks", async () => {
	const child = new EventEmitter();
	child.stdout = new EventEmitter();

	const started = waitForOpenCodeServerStarted(child);

	child.stdout.emit("data", Buffer.from('noise\n{"type":"server-'));
	child.stdout.emit(
		"data",
		Buffer.from(
			'started","port":4321,"url":"http://127.0.0.1:4321/?context=seed"}\n',
		),
	);

	const result = await Promise.race([
		started,
		new Promise((resolve) => setTimeout(() => resolve("timed out"), 50)),
	]);

	assert.notEqual(result, "timed out");
	assert.deepEqual(result, {
		type: "server-started",
		port: 4321,
		url: "http://127.0.0.1:4321/?context=seed",
	});
});

test("client adapters share the same base-ref resolution behavior", () => {
	assert.equal(
		resolveOpenCodeBaseRef({ explicitBase: "develop", cwd: process.cwd() }),
		"develop",
	);
	assert.equal(
		resolvePiBaseRef({ explicitBase: "develop", cwd: process.cwd() }),
		"develop",
	);
});
