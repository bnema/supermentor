import type { ChildProcess } from "node:child_process";

export interface SuperlearnerStartedEvent {
	type: "server-started";
	port: number;
	host: string;
	url: string;
	token: string;
	sessionId: string;
	sessionDir: string;
}

export interface SpawnSuperlearnerOptions {
	cwd?: string;
	serverPath?: string;
	env?: Record<string, string | undefined>;
	stdio?: ["pipe" | "ignore" | "inherit", "pipe" | "ignore" | "inherit", "pipe" | "ignore" | "inherit"];
}

export const defaultSuperlearnerServerPath: string;
export function parseServerEventLine(line: string): unknown | null;
export function waitForServerStarted(child: ChildProcess): Promise<SuperlearnerStartedEvent>;
export function buildSuperlearnerUrl(started: Partial<SuperlearnerStartedEvent>, params?: Record<string, unknown>): string;
export function spawnSuperlearnerServer(options?: SpawnSuperlearnerOptions): ChildProcess;
export function writeSuperlearnerAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
