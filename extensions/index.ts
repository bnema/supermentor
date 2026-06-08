import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parseServerEventLine } from "../client-shared.js";
import type { SupermentorStartedEvent } from "../client-shared.js";
import { formatAgentActionPrompt, formatInlineQuestionPrompt } from "../mentor-prompt.js";
import {
	buildPiSupermentorUrl,
	spawnPiSupermentorServer,
	waitForServerStarted,
	writePiSupermentorAck,
} from "../pi.js";

type Child = ReturnType<typeof spawnPiSupermentorServer>;

type Started = SupermentorStartedEvent;

const MAX_STDOUT_BUFFER_BYTES = 64 * 1024;

type AgentEvent = {
	type: "inline-question" | "agent-action";
	requestId: string;
	payload: unknown;
};

function isAgentEvent(event: unknown): event is AgentEvent {
	if (typeof event !== "object" || event === null) return false;
	const type = (event as { type?: unknown }).type;
	return (type === "inline-question" || type === "agent-action") && typeof (event as { requestId?: unknown }).requestId === "string";
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
		if (!isAgentEvent(event)) return;

		try {
			const prompt = event.type === "agent-action" ? formatAgentActionPrompt(event.payload) : formatInlineQuestionPrompt(event.payload);
			const delivery = Promise.resolve(pi.sendUserMessage(prompt, { deliverAs: "followUp" }));
			if (child) {
				writePiSupermentorAck(child, event.requestId, {
					ok: true,
					message: `${event.type === "agent-action" ? "Agent action" : "Inline question"} queued in pi session`,
				});
			}
			delivery.catch((error) => {
				const message = error instanceof Error ? error.message : `Failed to deliver ${event.type}`;
				pi.sendMessage({ customType: "supermentor-error", display: true, content: `supermentor ${event.type} delivery failed: ${message}` });
			});
		} catch (error) {
			if (child) {
				writePiSupermentorAck(child, event.requestId, {
					ok: false,
					error: error instanceof Error ? error.message : `Failed to deliver ${event.type}`,
				});
			}
		}
	}

	async function startBrowserCompanion(title: string, ctx: any) {
		if (child && !child.killed) {
			if (started && startedUrl) return { ok: true, alreadyRunning: true, started, url: startedUrl, title };
			return { ok: false, error: "supermentor is already starting" };
		}

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
			if (code && code !== 0) pi.sendMessage({ customType: "supermentor-error", display: true, content: `supermentor exited (${code}${signal ? ` ${signal}` : ""}) ${stderr}`.trim() });
		});

		try {
			started = (await waitForServerStarted(current)) as Started;
		} catch (error) {
			if (child === current) stopServer();
			const message = error instanceof Error ? error.message : "supermentor failed to start";
			const details = stderr.trim() ? `: ${stderr.trim().split("\n").at(-1)}` : "";
			return { ok: false, error: `${message}${details}` };
		}

		const url = buildPiSupermentorUrl(started);
		startedUrl = url;
		pi.appendEntry("supermentor-session", { ...started, url, title });
		pi.sendMessage({
			customType: "supermentor-session",
			display: true,
			content: [
				`supermentor browser companion started: ${url}`,
				`Session directory: ${started.sessionDir}`,
				`To publish or update the lesson, write a learning-document JSON to: ${started.sessionDir}/lesson.json`,
				"Inline questions and exercise actions from the browser will arrive as side-thread prompts. Answer them by writing the requested reply.json file.",
			].join("\n"),
			details: { ...started, url, title },
		});
		return { ok: true, alreadyRunning: false, started, url, title };
	}

	pi.registerTool({
		name: "supermentor_start",
		label: "Supermentor Start",
		description: "Start or reuse the integrated Supermentor browser companion for a learning session.",
		promptSnippet: "Start or reuse the Supermentor browser companion and return its URL/session directory.",
		promptGuidelines: [
			"Use supermentor_start when a learning request is broad enough that a browser lesson would be easier to follow than a long terminal response.",
			"Use supermentor_start when the user asks to start the Supermentor server, open the browser companion, or make the lesson commentable.",
			"Do not start Supermentor manually with bash in Pi; use supermentor_start so inline browser questions can route back into the active session.",
		],
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: {
				title: { type: "string", description: "Short title for the learning session" },
			},
		} as any,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const title = params.title?.trim() || "Supermentor session";
			const result = await startBrowserCompanion(title, ctx);
			if (!result.ok) {
				return { content: [{ type: "text", text: `Failed to start Supermentor: ${result.error}` }], details: result, isError: true };
			}
			return {
				content: [
					{
						type: "text",
						text: `${result.alreadyRunning ? "Supermentor already running" : "Supermentor started"}: ${result.url}\nSession directory: ${result.started?.sessionDir}`,
					},
				],
				details: result,
			};
		},
	});

	pi.registerCommand("supermentor-start", {
		description: "Start the supermentor browser companion (usage: /supermentor-start Learning session)",
		handler: async (args, ctx) => {
			const title = args.trim() || "Supermentor session";
			const result = await startBrowserCompanion(title, ctx);
			if (!result.ok) {
				ctx.ui.notify(result.error || "supermentor failed to start", "error");
				return;
			}
			ctx.ui.notify(result.url ? `supermentor ready: ${result.url}` : "supermentor is already starting", "info");
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
