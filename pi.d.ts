import type { ChildProcess } from "node:child_process";
import type { SpawnSupermentorOptions, SupermentorStartedEvent } from "./client-shared.js";

export interface PiSupermentorArgs extends SpawnSupermentorOptions {
	sessionID?: string;
	title?: string;
	sessionDir?: string;
	cacheDir?: string;
}

export function waitForServerStarted(child: ChildProcess): Promise<SupermentorStartedEvent>;
export function piSupermentorServerOptions(args?: PiSupermentorArgs): SpawnSupermentorOptions;
export function spawnPiSupermentorServer(args?: PiSupermentorArgs): ChildProcess;
export function buildPiSupermentorUrl(started: SupermentorStartedEvent, args?: PiSupermentorArgs): string;
export function writePiSupermentorAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
