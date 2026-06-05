import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parseServerEventLine } from "../client-shared.js";
import type { SuperlearnerStartedEvent } from "../client-shared.js";
import { formatInlineQuestionPrompt } from "../learner-prompt.js";
import {
	buildPiSuperlearnerUrl,
	spawnPiSuperlearnerServer,
	waitForServerStarted,
	writePiSuperlearnerAck,
} from "../pi.js";

type Child = ReturnType<typeof spawnPiSuperlearnerServer>;

type Started = SuperlearnerStartedEvent;

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

export default function superlearnerExtension(pi: ExtensionAPI) {
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
				writePiSuperlearnerAck(child, event.requestId, {
					ok: true,
					message: "Inline question delivered to pi session",
				});
			}
		} catch (error) {
			if (child) {
				writePiSuperlearnerAck(child, event.requestId, {
					ok: false,
					error: error instanceof Error ? error.message : "Failed to deliver inline question",
				});
			}
		}
	}

	pi.registerCommand("superlearner-start", {
		description: "Start the superlearner browser companion (usage: /superlearner-start [title])",
		handler: async (args, ctx) => {
			if (child && !child.killed) {
				ctx.ui.notify(startedUrl ? `superlearner already running: ${startedUrl}` : "superlearner is already starting", "info");
				return;
			}

			const title = args.trim() || "Superlearner session";
			child = spawnPiSuperlearnerServer({ cwd: ctx.cwd, title, sessionID: ctx.sessionManager.getSessionId() });
			const current = child;

			current.stdout?.on("data", (chunk: Buffer) => {
				stdoutBuffer += chunk.toString();
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
				if (code && code !== 0) ctx.ui.notify(`superlearner exited (${code}${signal ? ` ${signal}` : ""}) ${stderr}`.trim(), "warning");
			});

			try {
				started = (await waitForServerStarted(current)) as Started;
			} catch (error) {
				if (child === current) stopServer();
				const message = error instanceof Error ? error.message : "superlearner failed to start";
				const details = stderr.trim() ? `: ${stderr.trim().split("\n").at(-1)}` : "";
				ctx.ui.notify(`${message}${details}`, "error");
				return;
			}

			const url = buildPiSuperlearnerUrl(started);
			startedUrl = url;
			ctx.ui.notify(`superlearner ready: ${url}`, "info");
			pi.appendEntry("superlearner-session", { ...started, url, title });
			pi.sendMessage({
				customType: "superlearner-session",
				display: true,
				content: [
					`superlearner browser companion started: ${url}`,
					`Session directory: ${started.sessionDir}`,
					`To publish or update the lesson, write a learning-document JSON to: ${started.sessionDir}/lesson.json`,
					"Inline questions from the browser will arrive as side-thread prompts. Answer them by writing the requested reply.json file.",
				].join("\n"),
				details: { ...started, url, title },
			});
		},
	});

	pi.registerCommand("superlearner-status", {
		description: "Show the current superlearner browser companion URL",
		handler: async (_args, ctx) => {
			if (!child || child.killed || !started) {
				ctx.ui.notify("No superlearner server is running", "warning");
				return;
			}
			ctx.ui.notify(`superlearner: ${startedUrl} (${started.sessionDir})`, "info");
		},
	});

	pi.registerCommand("superlearner-stop", {
		description: "Stop the current superlearner browser companion",
		handler: async (_args, ctx) => {
			const wasRunning = Boolean(child && !child.killed);
			stopServer();
			ctx.ui.notify(wasRunning ? "superlearner stopped" : "No superlearner server was running", wasRunning ? "info" : "warning");
		},
	});

	pi.on("session_shutdown", () => {
		stopServer();
	});
}
