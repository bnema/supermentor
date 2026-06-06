#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const home = os.homedir();

const client = process.argv[2];
const args = new Set(process.argv.slice(3));

function usage() {
	console.log(`Usage:
  node scripts/install-local.mjs pi
  node scripts/install-local.mjs opencode
  node scripts/install-local.mjs claude
  node scripts/install-local.mjs codex
  node scripts/install-local.mjs all

Clients:
  pi          Run: pi install <this checkout>
  opencode    Link the OpenCode plugin into ~/.config/opencode/plugins/
  claude      Link this checkout as a Claude Code skills-directory plugin
  codex       Link Supermentor skills into ~/.agents/skills/
  all         Install all local integrations above

Options:
  --copy      Copy files/directories instead of creating symlinks where supported

Example:
  node scripts/install-local.mjs codex --copy
`);
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function removeExisting(target) {
	fs.rmSync(target, { recursive: true, force: true });
}

function linkOrCopy(source, target, type = "dir") {
	ensureDir(path.dirname(target));
	removeExisting(target);
	if (args.has("--copy")) {
		if (type === "file") fs.copyFileSync(source, target);
		else fs.cpSync(source, target, { recursive: true });
		console.log(`copied ${target}`);
		return;
	}
	fs.symlinkSync(source, target, type === "file" ? "file" : "junction");
	console.log(`linked ${target} -> ${source}`);
}

function installPi() {
	execFileSync("pi", ["install", repoRoot], { stdio: "inherit" });
}

function installOpenCode() {
	const source = path.join(repoRoot, ".opencode/plugins/supermentor.js");
	const target = path.join(home, ".config/opencode/plugins/supermentor.js");
	if (args.has("--copy")) {
		ensureDir(path.dirname(target));
		removeExisting(target);
		const sourceUrl = pathToFileURL(source).href;
		fs.writeFileSync(target, `export { SupermentorPlugin } from ${JSON.stringify(sourceUrl)};\n`);
		console.log(`wrote ${target}`);
	} else {
		linkOrCopy(source, target, "file");
	}
	console.log("Restart OpenCode, then ask: Tell me about Supermentor.");
}

function installClaude() {
	const target = path.join(home, ".claude/skills/supermentor");
	linkOrCopy(repoRoot, target, "dir");
	console.log("Restart Claude Code or run /reload-plugins. Supermentor loads as a local skills-directory plugin.");
}

function installCodex() {
	const skillsTarget = path.join(home, ".agents/skills");
	for (const skill of ["using-supermentor", "supermentor-code-dissection", "supermentor-guided-learning", "supermentor-codebase-tour"]) {
		linkOrCopy(path.join(repoRoot, "skills", skill), path.join(skillsTarget, skill), "dir");
	}
	console.log("Restart Codex, then run /skills or mention $using-supermentor to verify.");
}

const installers = {
	pi: installPi,
	opencode: installOpenCode,
	claude: installClaude,
	codex: installCodex,
};

if (!client || client === "--help" || client === "-h") {
	usage();
	process.exit(client ? 0 : 2);
}

try {
	if (client === "all") {
		for (const name of Object.keys(installers)) installers[name]();
	} else if (installers[client]) {
		installers[client]();
	} else {
		usage();
		process.exit(2);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
