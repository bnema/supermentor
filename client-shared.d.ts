import type { ChildProcess } from "node:child_process";

export interface SupermentorStartedEvent {
	type: "server-started";
	port: number;
	host: string;
	url: string;
	token: string;
	sessionId: string;
	sessionDir: string;
}

export interface SpawnSupermentorOptions {
	cwd?: string;
	serverPath?: string;
	env?: Record<string, string | undefined>;
	stdio?: ["pipe" | "ignore" | "inherit", "pipe" | "ignore" | "inherit", "pipe" | "ignore" | "inherit"];
}

export const defaultSupermentorServerPath: string;
export function parseServerEventLine(line: string): unknown | null;
export function waitForServerStarted(child: ChildProcess): Promise<SupermentorStartedEvent>;
export function buildSupermentorUrl(started: Partial<SupermentorStartedEvent>, params?: Record<string, unknown>): string;
export function spawnSupermentorServer(options?: SpawnSupermentorOptions): ChildProcess;
export function writeSupermentorAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
