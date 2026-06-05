import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatInlineQuestionPrompt } from "../learner-prompt.js";
import {
	buildPiSuperlearnerUrl,
	spawnPiSuperlearnerServer,
	waitForServerStarted,
	writePiSuperlearnerAck,
} from "../pi.js";

type Child = ReturnType<typeof spawnPiSuperlearnerServer>;

type Started = {
	type: "server-started";
	url: string;
	port: number;
	token: string;
	sessionId: string;
	sessionDir: string;
};

export default function superlearnerExtension(pi: ExtensionAPI) {
	let child: Child | null = null;
	let started: Started | null = null;
	let stdoutBuffer = "";

	function stopServer() {
		if (child && !child.killed) child.kill();
		child = null;
		started = null;
		stdoutBuffer = "";
	}

	function handleStdoutLine(line: string) {
		let event: any;
		try {
			event = JSON.parse(line);
		} catch {
			return;
		}

		if (event?.type !== "inline-question" || !event.requestId) return;

		const prompt = formatInlineQuestionPrompt(event.payload);
		try {
			pi.sendUserMessage(prompt, { deliverAs: "followUp" });
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
			if (child && !child.killed && started) {
				ctx.ui.notify(`superlearner already running: ${buildPiSuperlearnerUrl(started)}`, "info");
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
					if (line) handleStdoutLine(line);
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
				}
				if (code && code !== 0) ctx.ui.notify(`superlearner exited (${code}${signal ? ` ${signal}` : ""}) ${stderr}`.trim(), "warning");
			});

			started = (await waitForServerStarted(current)) as Started;
			const url = buildPiSuperlearnerUrl(started);
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
			ctx.ui.notify(`superlearner: ${buildPiSuperlearnerUrl(started)} (${started.sessionDir})`, "info");
		},
	});

	pi.registerCommand("superlearner-stop", {
		description: "Stop the current superlearner browser companion",
		handler: async (_args, ctx) => {
			stopServer();
			ctx.ui.notify("superlearner stopped", "info");
		},
	});

	pi.on("session_shutdown", () => {
		stopServer();
	});
}
