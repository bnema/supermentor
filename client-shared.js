import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const defaultSuperlearnerServerPath = fileURLToPath(new URL("./server.cjs", import.meta.url));

export function parseServerEventLine(line) {
	try {
		return JSON.parse(line);
	} catch {
		return null;
	}
}

export async function waitForServerStarted(child) {
	return await new Promise((resolve, reject) => {
		let stdout = "";
		const cleanup = () => {
			child.stdout?.off("data", onData);
			child.off("error", onError);
			child.off("exit", onExit);
		};
		const finish = (fn, value) => {
			cleanup();
			fn(value);
		};
		const onData = (chunk) => {
			stdout += chunk.toString();
			let newlineIndex = stdout.indexOf("\n");
			while (newlineIndex !== -1) {
				const line = stdout.slice(0, newlineIndex).trim();
				stdout = stdout.slice(newlineIndex + 1);
				const message = line ? parseServerEventLine(line) : null;
				if (message?.type === "server-started") {
					finish(resolve, message);
					return;
				}
				newlineIndex = stdout.indexOf("\n");
			}
		};
		const onError = (error) => finish(reject, error);
		const onExit = (code) => finish(reject, new Error(`superlearner server exited early: ${code}`));
		child.stdout?.on("data", onData);
		child.once("error", onError);
		child.once("exit", onExit);
	});
}

export function buildSuperlearnerUrl(started, params = {}) {
	const url = new URL(started?.url || `http://127.0.0.1:${started?.port || 0}/`);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		url.searchParams.set(key, String(value));
	}
	return url.toString();
}

export function spawnSuperlearnerServer(options = {}) {
	return spawn(process.execPath, [options.serverPath || defaultSuperlearnerServerPath], {
		cwd: options.cwd || process.cwd(),
		env: { ...process.env, ...options.env },
		stdio: options.stdio || ["pipe", "pipe", "pipe"],
	});
}

export function writeSuperlearnerAck(child, requestId, ack) {
	if (!child.stdin || child.stdin.destroyed) throw new Error("superlearner server stdin is closed");
	child.stdin.write(
		`${JSON.stringify({
			type: "superlearner-ack",
			requestId,
			ok: ack.ok,
			...(ack.ok ? { message: ack.message } : { error: ack.error }),
		})}\n`,
	);
}
