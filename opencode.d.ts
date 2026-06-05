import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  ResolveBaseRefInput,
  ReviewAck,
  ServerStartedEvent,
  SpawnReviewServerOptions,
} from "./client-shared.js";

export { formatReviewPrompt } from "./review-prompt.js";
export declare function resolveBaseRef(input: ResolveBaseRefInput): string;
export declare function waitForServerStarted(
  child: ChildProcessWithoutNullStreams,
): Promise<ServerStartedEvent>;

export type OpenCodeAdapterArgs = {
  cwd: string;
  sessionID: string;
  baseRef?: string | null;
  serverPath?: string;
};

export type OpenCodeReviewUrlArgs = {
  sessionID: string;
  baseRef?: string | null;
};

export declare function openCodeReviewServerOptions(
  args: OpenCodeAdapterArgs,
): SpawnReviewServerOptions;
export declare function spawnOpenCodeReviewServer(
  args: OpenCodeAdapterArgs,
): ChildProcessWithoutNullStreams;
export declare function buildOpenCodeReviewUrl(
  started: Partial<ServerStartedEvent> | null | undefined,
  args: OpenCodeReviewUrlArgs,
): string;
export declare function writeOpenCodeReviewAck(
  child: ChildProcessWithoutNullStreams,
  requestId: string,
  ack: ReviewAck,
): void;
