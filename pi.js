import {
	buildSupermentorUrl,
	defaultSupermentorServerPath,
	spawnSupermentorServer,
	waitForServerStarted,
	writeSupermentorAck,
} from "./client-shared.js";

export { waitForServerStarted };

export function piSupermentorServerOptions(args = {}) {
	return {
		cwd: args.cwd || process.cwd(),
		serverPath: args.serverPath || defaultSupermentorServerPath,
		env: {
			SUPERMENTOR_CWD: args.cwd || process.cwd(),
			SUPERMENTOR_SESSION_ID: args.sessionID,
			SUPERMENTOR_TITLE: args.title,
			SUPERMENTOR_SESSION_DIR: args.sessionDir,
			SUPERMENTOR_CACHE_DIR: args.cacheDir,
		},
		stdio: ["pipe", "pipe", "pipe"],
	};
}

export function spawnPiSupermentorServer(args = {}) {
	return spawnSupermentorServer(piSupermentorServerOptions(args));
}

export function buildPiSupermentorUrl(started, args = {}) {
	return buildSupermentorUrl(started, { context: args.sessionID || started.sessionId });
}

export function writePiSupermentorAck(child, requestId, ack) {
	writeSupermentorAck(child, requestId, ack);
}
