#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cache = fs.mkdtempSync(path.join(os.tmpdir(), "superlearner-smoke-"));
const child = spawn(process.execPath, ["server.cjs"], {
	cwd: new URL("..", import.meta.url),
	env: {
		...process.env,
		SUPERLEARNER_CACHE_DIR: cache,
		SUPERLEARNER_TITLE: "Smoke lesson",
		SUPERLEARNER_ACK_TIMEOUT_MS: "2000",
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
	if (message) console[code ? "error" : "log"](message);
	process.exit(code);
}

const timeout = setTimeout(() => finish(1, "superlearner smoke timeout"), 8000);
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.stdout.on("data", async (chunk) => {
	stdout += chunk.toString();
	const lines = stdout.split("\n");
	for (const line of lines) {
		if (!line.trim().startsWith("{")) continue;
		let event;
		try {
			event = JSON.parse(line);
		} catch {
			continue;
		}
		if (event.type === "server-started") {
			void runSmoke(event).catch((error) => finish(1, error?.stack || String(error)));
			return;
		}
	}
});

async function runSmoke(started) {
	const session = await fetch(`${started.url}api/session`, {
		headers: { "x-superlearner-token": started.token },
	}).then((response) => response.json());
	if (session.lesson.title !== "Smoke lesson") throw new Error("lesson title mismatch");

	const submit = fetch(`${started.url}api/inline-question`, {
		method: "POST",
		headers: {
			"x-superlearner-token": started.token,
			"content-type": "application/json",
		},
		body: JSON.stringify({ blockId: "welcome", question: "Pourquoi ?", selection: "texte" }),
	});

	const inlineEvent = await waitForInlineQuestion();
	child.stdin.write(`${JSON.stringify({ type: "superlearner-ack", requestId: inlineEvent.requestId, ok: true, message: "delivered" })}\n`);
	const submitted = await submit.then((response) => response.json());
	if (!submitted.delivered) throw new Error("inline question was not acknowledged");

	const questionPath = inlineEvent.payload.paths.questionPath;
	const replyPath = inlineEvent.payload.paths.replyPath;
	if (!fs.existsSync(questionPath)) throw new Error("question file was not written");
	fs.writeFileSync(replyPath, `${JSON.stringify({ type: "inline_reply", threadId: submitted.threadId, markdown: "Réponse." })}\n`);

	const thread = await fetch(`${started.url}api/threads/${submitted.threadId}`, {
		headers: { "x-superlearner-token": started.token },
	}).then((response) => response.json());
	if (thread.reply.markdown !== "Réponse.") throw new Error("reply was not returned");
	finish(0, `superlearner smoke ok ${started.sessionId}`);
}

function waitForInlineQuestion() {
	return new Promise((resolve, reject) => {
		let buffer = stdout;
		const scan = () => {
			for (const line of buffer.split("\n")) {
				if (!line.trim().startsWith("{")) continue;
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (event.type === "inline-question") return event;
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
			reject(new Error("inline-question event timeout"));
		}, 3000).unref();
	});
}
