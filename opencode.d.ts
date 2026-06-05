import type { ChildProcess } from "node:child_process";
import type { SpawnSuperlearnerOptions, SuperlearnerStartedEvent } from "./client-shared.js";

export interface OpencodeSuperlearnerArgs extends SpawnSuperlearnerOptions {
	sessionID?: string;
	title?: string;
	sessionDir?: string;
	cacheDir?: string;
}

export function waitForServerStarted(child: ChildProcess): Promise<SuperlearnerStartedEvent>;
export function opencodeSuperlearnerServerOptions(args?: OpencodeSuperlearnerArgs): SpawnSuperlearnerOptions;
export function spawnOpencodeSuperlearnerServer(args?: OpencodeSuperlearnerArgs): ChildProcess;
export function buildOpencodeSuperlearnerUrl(started: SuperlearnerStartedEvent, args?: OpencodeSuperlearnerArgs): string;
export function writeOpencodeSuperlearnerAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
