import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parseServerEventLine } from "../client-shared.js";
import type { SupermentorStartedEvent } from "../client-shared.js";
import { formatInlineQuestionPrompt } from "../mentor-prompt.js";
import {
	buildPiSupermentorUrl,
	spawnPiSupermentorServer,
	waitForServerStarted,
	writePiSupermentorAck,
} from "../pi.js";

type Child = ReturnType<typeof spawnPiSupermentorServer>;

type Started = SupermentorStartedEvent;

const MAX_STDOUT_BUFFER_BYTES = 64 * 1024;

type InlineQuestionEvent = {
	type: "inline-question";
	requestId: string;
	payload: unknown;
};

function isInlineQuestionEvent(event: unknown): event is InlineQuestionEvent {
	return (
		typeof event === "object" &&
		event !== null &&
		(event as { type?: unknown }).type === "inline-question" &&
		typeof (event as { requestId?: unknown }).requestId === "string"
	);
}

export default function supermentorExtension(pi: ExtensionAPI) {
	let child: Child | null = null;
	let started: Started | null = null;
	let startedUrl: string | null = null;
	let stdoutBuffer = "";

	function stopServer() {
		if (child && !child.killed) child.kill();
		child = null;
		started = null;
		startedUrl = null;
		stdoutBuffer = "";
	}

	async function handleStdoutLine(line: string) {
		const event = parseServerEventLine(line);
		if (!isInlineQuestionEvent(event)) return;

		const prompt = formatInlineQuestionPrompt(event.payload);
		try {
			await Promise.resolve(pi.sendUserMessage(prompt, { deliverAs: "followUp" }));
			if (child) {
				writePiSupermentorAck(child, event.requestId, {
					ok: true,
					message: "Inline question delivered to pi session",
				});
			}
		} catch (error) {
			if (child) {
				writePiSupermentorAck(child, event.requestId, {
					ok: false,
					error: error instanceof Error ? error.message : "Failed to deliver inline question",
				});
			}
		}
	}

	pi.registerCommand("supermentor-start", {
		description: "Start the supermentor browser companion (usage: /supermentor-start [title])",
		handler: async (args, ctx) => {
			if (child && !child.killed) {
				ctx.ui.notify(startedUrl ? `supermentor already running: ${startedUrl}` : "supermentor is already starting", "info");
				return;
			}

			const title = args.trim() || "Supermentor session";
			child = spawnPiSupermentorServer({ cwd: ctx.cwd, title, sessionID: ctx.sessionManager.getSessionId() });
			const current = child;

			current.stdout?.on("data", (chunk: Buffer) => {
				stdoutBuffer += chunk.toString();
				if (Buffer.byteLength(stdoutBuffer, "utf8") > MAX_STDOUT_BUFFER_BYTES) {
					stdoutBuffer = stdoutBuffer.slice(-MAX_STDOUT_BUFFER_BYTES);
				}
				let newlineIndex = stdoutBuffer.indexOf("\n");
				while (newlineIndex !== -1) {
					const line = stdoutBuffer.slice(0, newlineIndex).trim();
					stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
					if (line) void handleStdoutLine(line);
					newlineIndex = stdoutBuffer.indexOf("\n");
				}
			});

			let stderr = "";
			current.stderr?.on("data", (chunk: Buffer) => {
				stderr = (stderr + chunk.toString()).slice(-2048);
			});
			current.once("exit", (code: number | null, signal: string | null) => {
				if (child === current) {
					child = null;
					started = null;
					startedUrl = null;
				}
				if (code && code !== 0) ctx.ui.notify(`supermentor exited (${code}${signal ? ` ${signal}` : ""}) ${stderr}`.trim(), "warning");
			});

			try {
				started = (await waitForServerStarted(current)) as Started;
			} catch (error) {
				if (child === current) stopServer();
				const message = error instanceof Error ? error.message : "supermentor failed to start";
				const details = stderr.trim() ? `: ${stderr.trim().split("\n").at(-1)}` : "";
				ctx.ui.notify(`${message}${details}`, "error");
				return;
			}

			const url = buildPiSupermentorUrl(started);
			startedUrl = url;
			ctx.ui.notify(`supermentor ready: ${url}`, "info");
			pi.appendEntry("supermentor-session", { ...started, url, title });
			pi.sendMessage({
				customType: "supermentor-session",
				display: true,
				content: [
					`supermentor browser companion started: ${url}`,
					`Session directory: ${started.sessionDir}`,
					`To publish or update the lesson, write a learning-document JSON to: ${started.sessionDir}/lesson.json`,
					"Inline questions from the browser will arrive as side-thread prompts. Answer them by writing the requested reply.json file.",
				].join("\n"),
				details: { ...started, url, title },
			});
		},
	});

	pi.registerCommand("supermentor-status", {
		description: "Show the current supermentor browser companion URL",
		handler: async (_args, ctx) => {
			if (!child || child.killed || !started) {
				ctx.ui.notify("No supermentor server is running", "warning");
				return;
			}
			ctx.ui.notify(`supermentor: ${startedUrl} (${started.sessionDir})`, "info");
		},
	});

	pi.registerCommand("supermentor-stop", {
		description: "Stop the current supermentor browser companion",
		handler: async (_args, ctx) => {
			const wasRunning = Boolean(child && !child.killed);
			stopServer();
			ctx.ui.notify(wasRunning ? "supermentor stopped" : "No supermentor server was running", wasRunning ? "info" : "warning");
		},
	});

	pi.on("session_shutdown", () => {
		stopServer();
	});
}
