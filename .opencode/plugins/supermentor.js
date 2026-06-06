/**
 * Supermentor plugin for OpenCode.
 *
 * Local-only helper that:
 * 1. registers this checkout's skills/ directory; and
 * 2. injects the using-supermentor bootstrap once per conversation.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginFile = fs.realpathSync(fileURLToPath(import.meta.url));
const pluginDir = path.dirname(pluginFile);
const repoRoot = path.resolve(pluginDir, "../..");
const skillsDir = path.join(repoRoot, "skills");

let bootstrapCache;

function stripFrontmatter(content) {
	const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return match ? match[1].trim() : content.trim();
}

function readBootstrap() {
	if (bootstrapCache !== undefined) return bootstrapCache;
	const skillPath = path.join(skillsDir, "using-supermentor", "SKILL.md");
	if (!fs.existsSync(skillPath)) {
		bootstrapCache = null;
		return bootstrapCache;
	}

	const skill = stripFrontmatter(fs.readFileSync(skillPath, "utf8"));
	bootstrapCache = `<supermentor-bootstrap>
You have Supermentor installed from ${repoRoot}.

The using-supermentor skill is already loaded below. Follow it now; do not reload it redundantly unless the user asks to inspect the skill file.

${skill}

OpenCode notes:
- Use OpenCode's native skill tool to list or load other Supermentor skills when useful.
- Use OpenCode's native file, shell, and edit tools when the learner explicitly accepts repo/setup work.
- The optional browser companion is not yet fully wired for OpenCode inline questions; prefer chat unless a tested adapter is available.
</supermentor-bootstrap>`;
	return bootstrapCache;
}

export const SupermentorPlugin = async () => ({
	config: async (config) => {
		config.skills = config.skills || {};
		config.skills.paths = config.skills.paths || [];
		if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);
	},

	"experimental.chat.messages.transform": async (_input, output) => {
		const bootstrap = readBootstrap();
		if (!bootstrap || !output.messages.length) return;

		const firstUser = output.messages.find((message) => message.info.role === "user");
		if (!firstUser?.parts?.length) return;
		if (firstUser.parts.some((part) => part.type === "text" && part.text.includes("<supermentor-bootstrap>"))) return;

		const ref = firstUser.parts[0];
		firstUser.parts.unshift({ ...ref, type: "text", text: bootstrap });
	},
});
