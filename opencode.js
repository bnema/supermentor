import {
	buildSuperlearnerUrl,
	defaultSuperlearnerServerPath,
	spawnSuperlearnerServer,
	waitForServerStarted,
	writeSuperlearnerAck,
} from "./client-shared.js";

export { waitForServerStarted };

export function opencodeSuperlearnerServerOptions(args = {}) {
	return {
		cwd: args.cwd || process.cwd(),
		serverPath: args.serverPath || defaultSuperlearnerServerPath,
		env: {
			SUPERLEARNER_CWD: args.cwd || process.cwd(),
			SUPERLEARNER_SESSION_ID: args.sessionID,
			SUPERLEARNER_TITLE: args.title,
			SUPERLEARNER_SESSION_DIR: args.sessionDir,
			SUPERLEARNER_CACHE_DIR: args.cacheDir,
		},
		stdio: ["pipe", "pipe", "pipe"],
	};
}

export function spawnOpencodeSuperlearnerServer(args = {}) {
	return spawnSuperlearnerServer(opencodeSuperlearnerServerOptions(args));
}

export function buildOpencodeSuperlearnerUrl(started, args = {}) {
	return buildSuperlearnerUrl(started, { session: args.sessionID || started.sessionId });
}

export function writeOpencodeSuperlearnerAck(child, requestId, ack) {
	writeSuperlearnerAck(child, requestId, ack);
}
