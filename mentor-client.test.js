import assert from "node:assert/strict";
import test from "node:test";

import {
	buildExerciseActionPayload,
	buildInlineQuestionPayload,
	buildSections,
	escapeHtml,
	highlightedHtml,
	normalizeExerciseStep,
	resolveAnchors,
} from "./mentor-client.js";

test("client groups code and walkthrough blocks under the previous concept section", () => {
	const sections = buildSections([
		{ id: "mental", type: "concept", title: "Mental model" },
		{ id: "mental-code", type: "code", title: "Code" },
		{ id: "mental-step", type: "walkthrough-step", title: "Step", anchors: ["mental-code:1-2"] },
		{ id: "recap", type: "recap", title: "Recap" },
	]);

	assert.equal(sections.length, 2);
	assert.equal(sections[0].lead.id, "mental");
	assert.deepEqual(sections[0].children.map((block) => block.id), ["mental-code", "mental-step"]);
	assert.equal(sections[1].lead.id, "recap");
});

test("exercise steps infer stable ids and default English actions", () => {
	const step = normalizeExerciseStep({
		type: "exercise-step",
		title: "Write the parser",
		goal: "Parse input",
		instructions: "Edit the parser",
		constraints: "Keep it small",
		hints: "Start from the failing test",
		successCriteria: "Tests pass",
		files: ["src/parser.js"],
	});

	assert.equal(step.id, "write-the-parser");
	assert.equal(step.blockId, "write-the-parser");
	assert.equal(step.stepId, "write-the-parser");
	assert.deepEqual(step.instructions, ["Edit the parser"]);
	assert.deepEqual(step.constraints, ["Keep it small"]);
	assert.deepEqual(step.hints, ["Start from the failing test"]);
	assert.deepEqual(step.successCriteria, ["Tests pass"]);
	assert.deepEqual(step.files, [{ path: "src/parser.js" }]);
	assert.deepEqual(step.actions.map((item) => [item.action, item.label]), [
		["struggling", "I'm struggling"],
		["review_attempt", "Review my attempt"],
	]);
});

test("lesson block normalization deduplicates ids and tolerates malformed blocks", () => {
	const sections = buildSections([
		{ id: "repeat", type: "concept", title: "First" },
		{ id: "repeat", type: "concept", title: "Second" },
		null,
		"loose note",
	]);

	assert.deepEqual(sections.map((section) => section.lead.id), ["repeat", "repeat-1", "block-3", "block-4"]);
	assert.equal(sections[2].lead.type, "note");
	assert.equal(sections[3].lead.body, "loose note");
});

test("exercise blocks with exercise metadata infer default actions as top-level steps", () => {
	const sections = buildSections([
		{ id: "intro", type: "concept", title: "Intro" },
		{ type: "exercise", title: "Move the rectangle", goal: "Change position", successCriteria: ["Rectangle moved"] },
	]);

	assert.equal(sections.length, 2);
	const step = sections[1].lead;
	assert.equal(step.type, "exercise-step");
	assert.equal(step.stepId, "move-the-rectangle");
	assert.deepEqual(step.actions.map((item) => item.label), ["I'm struggling", "Review my attempt"]);
});

test("exercise action payload includes structured server contract fields", () => {
	const lesson = {
		id: "lesson-1",
		blocks: [{ type: "exercise-step", id: "step-1", title: "First step", body: "Try it yourself.", instructions: ["Edit main"], constraints: ["No solution copy"], hints: ["Start small"], files: ["main.odin"], successCriteria: ["Program prints ok"] }],
	};

	assert.deepEqual(buildExerciseActionPayload({
		lesson,
		bootstrap: { sessionId: "session-1" },
		blockId: "step-1",
		stepId: "step-1",
		action: "review_attempt",
		label: "Review my attempt",
		selection: "current attempt",
	}), {
		lessonId: "lesson-1",
		blockId: "step-1",
		parentBlockId: null,
		stepId: "step-1",
		action: "review_attempt",
		label: "Review my attempt",
		title: "First step",
		goal: "",
		body: "Try it yourself.",
		instructions: ["Edit main"],
		constraints: ["No solution copy"],
		hints: ["Start small"],
		files: [{ path: "main.odin" }],
		successCriteria: ["Program prints ok"],
		selection: "current attempt",
	});
});

test("exercise action payload anchors to rendered step id when parent block differs", () => {
	const lesson = {
		id: "lesson-1",
		blocks: [{ type: "exercise-step", id: "rendered-step", blockId: "parent-block", stepId: "step-1", title: "Step" }],
	};

	const payload = buildExerciseActionPayload({
		lesson,
		bootstrap: { sessionId: "session-1" },
		blockId: "rendered-step",
		stepId: "step-1",
		action: "struggling",
		label: "I'm struggling",
	});

	assert.equal(payload.blockId, "rendered-step");
	assert.equal(payload.parentBlockId, "parent-block");
	assert.equal(payload.stepId, "step-1");
});

test("client resolves walkthrough anchors to referenced code block file and lines", () => {
	const blocks = [
		{ id: "code-1", type: "code", file: "main.odin", startLine: 10, endLine: 18 },
		{ id: "step-1", type: "walkthrough-step", anchors: ["code-1:12-14"] },
	];

	assert.deepEqual(resolveAnchors(blocks[1], blocks), [
		{ raw: "code-1:12-14", blockId: "code-1", file: "main.odin", startLine: 12, endLine: 14 },
	]);
});

test("inline question payload preserves captured selection and source anchors", () => {
	const lesson = {
		id: "lesson-1",
		blocks: [
			{ id: "code-1", type: "code", file: "main.odin", startLine: 10, endLine: 18 },
			{ id: "step-1", type: "walkthrough-step", anchors: ["code-1:12-14"] },
		],
	};

	const payload = buildInlineQuestionPayload({
		lesson,
		bootstrap: { sessionId: "session-1" },
		blockId: "step-1",
		selection: "selected before textarea focus",
		question: "Why this line?",
	});

	assert.equal(payload.lessonId, "lesson-1");
	assert.equal(payload.blockId, "step-1");
	assert.equal(payload.selection, "selected before textarea focus");
	assert.equal(payload.anchor.file, "main.odin");
	assert.equal(payload.anchor.startLine, 12);
	assert.equal(payload.anchor.endLine, 14);
	assert.deepEqual(payload.anchor.anchors, ["code-1:12-14"]);
	assert.deepEqual(payload.anchor.resolvedAnchors, [
		{ raw: "code-1:12-14", blockId: "code-1", file: "main.odin", startLine: 12, endLine: 14 },
	]);
});

test("highlight fallback escapes unsafe code when highlighter is unavailable or throws", () => {
	assert.equal(highlightedHtml("<script>alert(1)</script>", "javascript", null), "&lt;script&gt;alert(1)&lt;/script&gt;");
	assert.equal(
		highlightedHtml("<b>x</b>", "javascript", { getLanguage: () => true, highlight: () => { throw new Error("boom"); } }),
		escapeHtml("<b>x</b>"),
	);
});
