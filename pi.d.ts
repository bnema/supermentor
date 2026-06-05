import type { ChildProcess } from "node:child_process";
import type { SpawnSuperlearnerOptions, SuperlearnerStartedEvent } from "./client-shared.js";

export interface PiSuperlearnerArgs extends SpawnSuperlearnerOptions {
	sessionID?: string;
	title?: string;
	sessionDir?: string;
	cacheDir?: string;
}

export function waitForServerStarted(child: ChildProcess): Promise<SuperlearnerStartedEvent>;
export function piSuperlearnerServerOptions(args?: PiSuperlearnerArgs): SpawnSuperlearnerOptions;
export function spawnPiSuperlearnerServer(args?: PiSuperlearnerArgs): ChildProcess;
export function buildPiSuperlearnerUrl(started: SuperlearnerStartedEvent, args?: PiSuperlearnerArgs): string;
export function writePiSuperlearnerAck(child: ChildProcess, requestId: string, ack: { ok: true; message?: string } | { ok: false; error: string }): void;
