import {
	buildSupermentorUrl,
	defaultSupermentorServerPath,
	spawnSupermentorServer,
	waitForServerStarted,
	writeSupermentorAck,
} from "./client-shared.js";

export { waitForServerStarted };

export function opencodeSupermentorServerOptions(args = {}) {
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

export function spawnOpencodeSupermentorServer(args = {}) {
	return spawnSupermentorServer(opencodeSupermentorServerOptions(args));
}

export function buildOpencodeSupermentorUrl(started, args = {}) {
	return buildSupermentorUrl(started, { session: args.sessionID || started.sessionId });
}

export function writeOpencodeSupermentorAck(child, requestId, ack) {
	writeSupermentorAck(child, requestId, ack);
}
