// @ts-check

import { actionLabel, EXERCISE_ACTION_IDS, normalizeStringList } from "./exercise-contract.js";

/**
 * Format a supermentor inline question event into a compact agent prompt.
 *
 * The answer body must be written to the reply file so the browser can render it
 * under the original comment. The main chat should only keep a compact trace.
 *
 * @param {unknown} eventPayload
 * @returns {string}
 */
export function formatInlineQuestionPrompt(eventPayload) {
	const context = promptContext(eventPayload);
	const lines = ["Supermentor inline question", "", `Thread: ${context.threadId}`, `Block: ${context.blockId}`];
	addPaths(lines, context);
	lines.push("", "Learner question:", context.question || "(see question JSON)");
	if (context.selection) lines.push("", "Selected passage:", fence(context.selection));
	addReplyInstructions(lines, context, [
		"- Use the current conversation/code context to answer pedagogically.",
	]);
	return lines.join("\n");
}

/**
 * Format a structured exercise action event into an agent prompt.
 * @param {unknown} eventPayload
 * @returns {string}
 */
export function formatAgentActionPrompt(eventPayload) {
	const context = promptContext(eventPayload);
	const action = EXERCISE_ACTION_IDS.has(/** @type {any} */ (context.action)) ? context.action : "struggling";
	const lines = ["Supermentor exercise action", "", `Thread: ${context.threadId}`, `Block: ${context.blockId}`, `Step: ${context.stepId || "unknown step"}`, `Action: ${action}`, `Label: ${context.label || action}`];
	addPaths(lines, context);
	if (context.title) lines.push("", "Exercise title:", context.title);
	if (context.goal) lines.push("", "Goal:", context.goal);
	if (context.body) lines.push("", "Exercise context:", context.body);
	addList(lines, "Instructions", context.instructions);
	addList(lines, "Constraints", context.constraints);
	addList(lines, "Hints", context.hints);
	if (context.files.length) lines.push("", "Files to inspect:", ...context.files.map((/** @type {string} */ file) => `- ${file}`));
	addList(lines, "Success criteria", context.successCriteria);
	if (context.question) lines.push("", "Learner note/question:", context.question);
	if (context.selection) lines.push("", "Selected passage:", fence(context.selection));
	const actionInstructions = [];
	if (action === "struggling") actionInstructions.push("- The learner is struggling: give a hint first, not a full solution by default.");
	if (action === "review_attempt") actionInstructions.push("- Inspect the listed files/current workspace when available before judging the attempt.", "- Treat review as the completion checkpoint for the step.", "- Do not overwrite learner code unless explicitly asked.");
	addReplyInstructions(lines, context, [
		"- Answer pedagogically for the relevant exercise block/step.",
		...actionInstructions,
	]);
	return lines.join("\n");
}

/**
 * @param {unknown} eventPayload
 */
function promptContext(eventPayload) {
	/** @type {any} */
	const payload = typeof eventPayload === "object" && eventPayload !== null ? eventPayload : {};
	const paths = typeof payload.paths === "object" && payload.paths !== null ? payload.paths : {};
	const files = Array.isArray(payload.files) ? payload.files.map(normalizeFileReference).filter(Boolean) : [];
	const action = payload.action ? String(payload.action) : "";
	return {
		threadId: String(payload.threadId || "unknown-thread"),
		blockId: payload.blockId ? String(payload.blockId) : "unknown block",
		stepId: payload.stepId ? String(payload.stepId) : "",
		action,
		label: payload.label ? String(payload.label) : actionLabel(action),
		title: payload.title ? String(payload.title).trim() : "",
		goal: payload.goal ? String(payload.goal).trim() : "",
		body: payload.body ? String(payload.body).trim() : "",
		question: payload.question ? String(payload.question).trim() : "",
		selection: payload.selection ? String(payload.selection).trim() : "",
		instructions: normalizeStringList(payload.instructions),
		constraints: normalizeStringList(payload.constraints),
		hints: normalizeStringList(payload.hints),
		successCriteria: normalizeStringList(payload.successCriteria),
		files,
		questionPath: String(paths.questionPath || payload.questionPath || ""),
		replyPath: String(paths.replyPath || payload.replyPath || ""),
	};
}

/**
 * @param {string[]} lines
 * @param {string} title
 * @param {string[]} items
 */
function addList(lines, title, items) {
	if (!items.length) return;
	lines.push("", `${title}:`, ...items.map((item) => `- ${item}`));
}

/**
 * @param {unknown} file
 * @returns {string}
 */
function normalizeFileReference(file) {
	if (typeof file === "string") return file.trim();
	if (file && typeof file === "object") {
		const value = /** @type {{ path?: unknown, file?: unknown, name?: unknown }} */ (file).path ?? /** @type {{ path?: unknown, file?: unknown, name?: unknown }} */ (file).file ?? /** @type {{ path?: unknown, file?: unknown, name?: unknown }} */ (file).name;
		return typeof value === "string" ? value.trim() : "";
	}
	return "";
}

/**
 * @param {string[]} lines
 * @param {{ questionPath: string, replyPath: string }} context
 */
function addPaths(lines, context) {
	if (context.questionPath) lines.push(`Read question JSON: ${context.questionPath}`);
	if (context.replyPath) lines.push(`Write reply JSON: ${context.replyPath}`);
}

/**
 * @param {string[]} lines
 * @param {{ threadId: string }} context
 * @param {string[]} instructions
 */
function addReplyInstructions(lines, context, instructions) {
	lines.push(
		"",
		"Instructions:",
		...instructions,
		"- Write the answer to reply.json using the reply JSON file path, not as a long chat response.",
		"- Reply JSON shape:",
		fence(JSON.stringify({ type: "inline_reply", threadId: context.threadId, markdown: "...", followups: [{ label: "Show me a trace", kind: "trace" }] }, null, 2), "json"),
		`- Keep the main chat compact after writing the file: say only \`Reply sent to comment ${context.threadId}\`.`
	);
}

/**
 * Generate a Markdown code fence that safely wraps text.
 * Computes a fence longer than any backtick run; language is optional.
 * @param {unknown} text
 * @param {string} [language=""]
 * @returns {string}
 */
function fence(text, language = "") {
	const value = String(text);
	const languageLabel = String(language);
	const runs = value.match(/`+/g)?.map((run) => run.length) || [0];
	const maxBacktickRun = Math.max(0, ...runs);
	const backticks = "`".repeat(Math.max(3, maxBacktickRun + 1));
	return `${backticks}${languageLabel}\n${value}\n${backticks}`;
}
