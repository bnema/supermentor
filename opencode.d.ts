import type { ChildProcess } from "node:child_process";
import type { SpawnSupermentorOptions, SupermentorStartedEvent } from "./client-shared.js";

export interface OpencodeSupermentorArgs extends SpawnSupermentorOptions {
	sessionID?: string;
	title?: string;
	sessionDir?: string;
	cacheDir?: string;
}

export function waitForServerStarted(child: ChildProcess): Promise<SupermentorStartedEvent>;
export function opencodeSupermentorServerOptions(args?: OpencodeSupermentorArgs): SpawnSupermentorOptions;
export function spawnOpencodeSupermentorServer(args?: OpencodeSupermentorArgs): ChildProcess;
export function buildOpencodeSupermentorUrl(started: SupermentorStartedEvent, args?: OpencodeSupermentorArgs): string;
export function writeOpencodeSupermentorAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
