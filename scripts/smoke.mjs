#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cache = fs.mkdtempSync(path.join(os.tmpdir(), "supermentor-smoke-"));
let smokeStarted = false;
const child = spawn(process.execPath, ["server.cjs"], {
	cwd: fileURLToPath(new URL("..", import.meta.url)),
	env: {
		...process.env,
		SUPERMENTOR_CACHE_DIR: cache,
		SUPERMENTOR_TITLE: "Smoke lesson",
		SUPERMENTOR_ACK_TIMEOUT_MS: "2000",
	},
	stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let done = false;

function finish(code, message) {
	if (done) return;
	done = true;
	clearTimeout(timeout);
	if (!child.killed) child.kill();
	fs.rmSync(cache, { recursive: true, force: true });
	if (message) console[code ? "error" : "log"](message);
	process.exit(code);
}

const timeout = setTimeout(() => finish(1, "supermentor smoke timeout"), 8000);
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.stdout.on("data", async (chunk) => {
	stdout += chunk.toString();
	const lines = stdout.split("\n");
	stdout = lines.pop() || "";
	for (const line of lines) {
		if (!line.trim().startsWith("{")) continue;
		let event;
		try {
			event = JSON.parse(line);
		} catch {
			continue;
		}
		if (event.type === "server-started" && !smokeStarted) {
			smokeStarted = true;
			void runSmoke(event).catch((error) => finish(1, error?.stack || String(error)));
			return;
		}
	}
});

async function runSmoke(started) {
	const session = await fetch(`${started.url}api/session`, {
		headers: { "x-supermentor-token": started.token },
	}).then((response) => response.json());
	if (session.lesson.title !== "Smoke lesson") throw new Error("lesson title mismatch");

	const submit = fetch(`${started.url}api/inline-question`, {
		method: "POST",
		headers: {
			"x-supermentor-token": started.token,
			"content-type": "application/json",
		},
		body: JSON.stringify({ blockId: "welcome", question: "Pourquoi ?", selection: "texte" }),
	});

	const inlineEvent = await waitForInlineQuestion();
	child.stdin.write(`${JSON.stringify({ type: "supermentor-ack", requestId: inlineEvent.requestId, ok: true, message: "delivered" })}\n`);
	const submitted = await submit.then((response) => response.json());
	if (!submitted.delivered) throw new Error("inline question was not acknowledged");

	const questionPath = inlineEvent.payload.paths.questionPath;
	const replyPath = inlineEvent.payload.paths.replyPath;
	if (!fs.existsSync(questionPath)) throw new Error("question file was not written");
	fs.writeFileSync(replyPath, `${JSON.stringify({ type: "inline_reply", threadId: submitted.threadId, markdown: "Reply." })}\n`);

	const thread = await fetch(`${started.url}api/threads/${submitted.threadId}`, {
		headers: { "x-supermentor-token": started.token },
	}).then((response) => response.json());
	if (thread.reply.markdown !== "Reply.") throw new Error("reply was not returned");

	const actionSubmit = fetch(`${started.url}api/agent-action`, {
		method: "POST",
		headers: {
			"x-supermentor-token": started.token,
			"content-type": "application/json",
		},
		body: JSON.stringify({ lessonId: "smoke", blockId: "welcome", stepId: "step-1", action: "struggling", label: "I'm struggling", files: ["server.cjs"], successCriteria: "Understand the smoke path." }),
	});
	const actionEvent = await waitForEvent("agent-action");
	child.stdin.write(`${JSON.stringify({ type: "supermentor-ack", requestId: actionEvent.requestId, ok: true, message: "delivered" })}\n`);
	const actionSubmitted = await actionSubmit.then((response) => response.json());
	if (!actionSubmitted.delivered) throw new Error("agent action was not acknowledged");
	if (!fs.existsSync(actionEvent.payload.paths.questionPath)) throw new Error("agent action question file was not written");
	finish(0, `supermentor smoke ok ${started.sessionId}`);
}

function waitForInlineQuestion() {
	return waitForEvent("inline-question");
}

function waitForEvent(type) {
	return new Promise((resolve, reject) => {
		let buffer = stdout;
		const scan = () => {
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) {
				if (!line.trim().startsWith("{")) continue;
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (event.type === type) return event;
			}
			return null;
		};
		const existing = scan();
		if (existing) {
			resolve(existing);
			return;
		}
		const onData = (chunk) => {
			buffer += chunk.toString();
			const event = scan();
			if (event) {
				child.stdout.off("data", onData);
				resolve(event);
			}
		};
		child.stdout.on("data", onData);
		setTimeout(() => {
			child.stdout.off("data", onData);
			reject(new Error(`${type} event timeout`));
		}, 3000).unref();
	});
}
