// @ts-check

/**
 * Format a superlearner inline question event into a compact agent prompt.
 *
 * The answer body must be written to the reply file so the browser can render it
 * under the original comment. The main chat should only keep a compact trace.
 *
 * @param {unknown} eventPayload
 * @returns {string}
 */
export function formatInlineQuestionPrompt(eventPayload) {
	/** @type {any} */
	const payload = typeof eventPayload === "object" && eventPayload !== null ? eventPayload : {};
	const paths = typeof payload.paths === "object" && payload.paths !== null ? payload.paths : {};
	const questionPath = String(paths.questionPath || payload.questionPath || "");
	const replyPath = String(paths.replyPath || payload.replyPath || "");
	const threadId = String(payload.threadId || "unknown-thread");
	const blockId = payload.blockId ? String(payload.blockId) : "unknown block";
	const question = payload.question ? String(payload.question).trim() : "";
	const selection = payload.selection ? String(payload.selection).trim() : "";

	const lines = [
		"Superlearner inline question",
		"",
		`Thread: ${threadId}`,
		`Block: ${blockId}`,
	];
	if (questionPath) lines.push(`Read question JSON: ${questionPath}`);
	if (replyPath) lines.push(`Write reply JSON: ${replyPath}`);
	lines.push("", "Learner question:", question || "(see question JSON)");
	if (selection) lines.push("", "Selected passage:", fence(selection));
	lines.push(
		"",
		"Instructions:",
		"- Use the current conversation/code context to answer pedagogically.",
		"- Write the answer to the reply JSON file, not as a long chat response.",
		"- Reply JSON shape:",
		fence(JSON.stringify({ type: "inline_reply", threadId, markdown: "...", followups: [{ label: "Déroule-moi une trace", kind: "trace" }] }, null, 2), "json"),
		"- Keep the main chat compact after writing the file: say only `Réponse envoyée au commentaire " + threadId + "`."
	);
	return lines.join("\n");
}

function fence(text, language = "") {
	const runs = String(text).match(/`+/g)?.map((run) => run.length) || [0];
	const maxBacktickRun = Math.max(0, ...runs);
	const backticks = "`".repeat(Math.max(3, maxBacktickRun + 1));
	return `${backticks}${language}\n${text}\n${backticks}`;
}
