import assert from "node:assert/strict";
import test from "node:test";

import {
	buildInlineQuestionPayload,
	buildSections,
	escapeHtml,
	highlightedHtml,
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
