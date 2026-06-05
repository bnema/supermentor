import { initTheme, toggleTheme } from "./learner-theme.js";

function $(selector, root = document) {
	return root.querySelector(selector);
}

function readBootstrap() {
	const element = document.getElementById("superlearner-bootstrap");
	if (!element) throw new Error("missing superlearner bootstrap");
	return JSON.parse(element.textContent || "{}");
}

const bootstrap = readBootstrap();
const headers = { "x-superlearner-token": bootstrap.token };
let currentLesson = null;
let currentThreads = [];
let pollTimers = new Map();

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function renderInlineMarkdown(text) {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\n/g, "<br>");
}

function renderMarkdown(text) {
	const source = String(text || "").trim();
	if (!source) return "";
	const parts = source.split(/(```[\s\S]*?```)/g);
	return parts
		.map((part) => {
			if (part.startsWith("```")) {
				const lines = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").split("\n");
				return `<pre><code>${escapeHtml(lines.join("\n"))}</code></pre>`;
			}
			return part
				.split(/\n{2,}/)
				.map((paragraph) => `<p>${renderInlineMarkdown(paragraph)}</p>`)
				.join("");
		})
		.join("");
}

function blockLabel(type) {
	return {
		concept: "Concept",
		code: "Code",
		"walkthrough-step": "Étape",
		exercise: "Exercice",
		prediction: "Prédiction",
		recap: "À retenir",
		trace: "Trace",
	}[type] || "Section";
}

async function api(path, options = {}) {
	const response = await fetch(path, {
		...options,
		headers: {
			...headers,
			...(options.body ? { "content-type": "application/json" } : {}),
			...(options.headers || {}),
		},
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	return await response.json();
}

function selectedTextInside(block) {
	const selection = window.getSelection?.();
	if (!selection || selection.isCollapsed) return "";
	if (!block.contains(selection.anchorNode) || !block.contains(selection.focusNode)) return "";
	return selection.toString().trim();
}

function renderCodeBlock(block) {
	const code = String(block.code || block.body || "");
	const start = Number(block.startLine || 1);
	const lines = code.split("\n");
	return `<pre class="sl-code"><code>${lines
		.map((line, index) => {
			const n = start + index;
			return `<span class="sl-code-line" data-line="${n}"><span class="sl-line-no">${n}</span><span class="sl-line-text">${escapeHtml(line || " ")}</span></span>`;
		})
		.join("\n")}</code></pre>`;
}

function threadsForBlock(blockId) {
	return currentThreads.filter((thread) => thread.question?.blockId === blockId);
}

function renderThread(thread) {
	const question = thread.question || {};
	const reply = thread.reply || null;
	return `<article class="sl-thread" data-thread-id="${escapeHtml(thread.threadId)}">
		<div class="sl-thread-question">
			<strong>Question</strong>
			<p>${renderInlineMarkdown(question.question || "")}</p>
			${question.selection ? `<blockquote>${renderInlineMarkdown(question.selection)}</blockquote>` : ""}
		</div>
		<div class="sl-thread-reply ${reply ? "" : "is-pending"}">
			<strong>${reply ? "Réponse" : "En attente de la réponse de l’agent…"}</strong>
			${reply?.markdown ? renderMarkdown(reply.markdown) : ""}
			${Array.isArray(reply?.followups) && reply.followups.length ? `<div class="sl-followups">${reply.followups.map((item) => `<button type="button" data-followup="${escapeHtml(item.kind || item.action || item.label)}">${escapeHtml(item.label || item.kind || "Approfondir")}</button>`).join("")}</div>` : ""}
		</div>
	</article>`;
}

function renderBlock(block, index) {
	const id = block.id || `block-${index + 1}`;
	const title = block.title || blockLabel(block.type);
	const body = block.type === "code" ? renderCodeBlock(block) : renderMarkdown(block.body || block.markdown || "");
	const source = block.file ? `<span class="sl-source">${escapeHtml(block.file)}${block.startLine ? `:${block.startLine}${block.endLine ? `-${block.endLine}` : ""}` : ""}</span>` : "";
	return `<article class="sl-block sl-block-${escapeHtml(block.type || "section")}" id="${escapeHtml(id)}" data-block-id="${escapeHtml(id)}">
		<header class="sl-block-header">
			<div><span class="sl-block-kind">${escapeHtml(blockLabel(block.type))}</span><h2>${escapeHtml(title)}</h2>${source}</div>
			<button class="sl-comment-button" type="button">Commenter</button>
		</header>
		<div class="sl-block-body">${body}</div>
		<div class="sl-composer" hidden>
			<label>Ta question sur ce passage</label>
			<textarea rows="4" placeholder="Dis-moi ce qui est flou, ce que tu veux voir déroulé, ou demande un exemple…"></textarea>
			<div class="sl-composer-actions"><button type="button" data-action="cancel">Annuler</button><button type="button" data-action="submit">Envoyer</button></div>
		</div>
		<div class="sl-threads">${threadsForBlock(id).map(renderThread).join("")}</div>
	</article>`;
}

function renderOutline(lesson) {
	const outline = document.getElementById("lesson-outline");
	const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
	outline.innerHTML = `<div class="sl-sidebar-title">Session</div>
		<div class="sl-session-id">${escapeHtml(bootstrap.sessionId)}</div>
		<nav>${blocks
			.map((block, index) => {
				const id = block.id || `block-${index + 1}`;
				return `<a href="#${escapeHtml(id)}"><span>${index + 1}</span>${escapeHtml(block.title || blockLabel(block.type))}</a>`;
			})
			.join("")}</nav>`;
}

function renderLesson() {
	if (!currentLesson) return;
	$("#lesson-title").textContent = currentLesson.title || "Superlearner";
	const view = document.getElementById("lesson-view");
	const blocks = Array.isArray(currentLesson.blocks) ? currentLesson.blocks : [];
	view.innerHTML = `${currentLesson.intro ? `<section class="sl-intro">${renderMarkdown(currentLesson.intro)}</section>` : ""}${blocks.map(renderBlock).join("")}`;
	renderOutline(currentLesson);
	bindLessonEvents(view);
}

function bindLessonEvents(root) {
	root.querySelectorAll(".sl-comment-button").forEach((button) => {
		button.addEventListener("click", () => {
			const block = button.closest(".sl-block");
			const composer = block.querySelector(".sl-composer");
			composer.hidden = false;
			const selected = selectedTextInside(block);
			const textarea = composer.querySelector("textarea");
			textarea.focus();
			if (selected && !textarea.value) textarea.placeholder = `Question sur : ${selected.slice(0, 160)}`;
		});
	});
	root.querySelectorAll(".sl-composer [data-action='cancel']").forEach((button) => {
		button.addEventListener("click", () => {
			const composer = button.closest(".sl-composer");
			composer.hidden = true;
			composer.querySelector("textarea").value = "";
		});
	});
	root.querySelectorAll(".sl-composer [data-action='submit']").forEach((button) => {
		button.addEventListener("click", async () => {
			const block = button.closest(".sl-block");
			const composer = button.closest(".sl-composer");
			const textarea = composer.querySelector("textarea");
			const question = textarea.value.trim();
			if (!question) return;
			button.disabled = true;
			try {
				const blockId = block.dataset.blockId;
				const lessonBlock = (currentLesson.blocks || []).find((item) => (item.id || "") === blockId) || {};
				const selection = selectedTextInside(block) || "";
				const result = await api("/api/inline-question", {
					method: "POST",
					body: JSON.stringify({
						lessonId: currentLesson.lessonId || currentLesson.id || bootstrap.sessionId,
						blockId,
						anchor: {
							blockId,
							file: lessonBlock.file || null,
							startLine: lessonBlock.startLine || null,
							endLine: lessonBlock.endLine || null,
						},
						selection,
						question,
					}),
				});
				currentThreads.push({ threadId: result.threadId, question: { threadId: result.threadId, blockId, question, selection }, reply: null });
				composer.hidden = true;
				textarea.value = "";
				renderLesson();
				startThreadPolling(result.threadId);
			} catch (error) {
				const message = error instanceof Error ? error.message : "La question n’a pas pu être envoyée à l’agent.";
				composer.querySelector("textarea").focus();
				alert(`Superlearner: ${message}`);
			} finally {
				button.disabled = false;
			}
		});
	});
}

function startThreadPolling(threadId) {
	if (pollTimers.has(threadId)) return;
	const poll = async () => {
		try {
			const thread = await api(`/api/threads/${encodeURIComponent(threadId)}`);
			const index = currentThreads.findIndex((item) => item.threadId === threadId);
			if (index === -1) currentThreads.push(thread);
			else currentThreads[index] = thread;
			renderLesson();
			if (thread.reply) {
				clearInterval(pollTimers.get(threadId));
				pollTimers.delete(threadId);
			}
		} catch {}
	};
	pollTimers.set(threadId, setInterval(poll, 2000));
	void poll();
}

async function loadSession() {
	const session = await api("/api/session");
	currentLesson = session.lesson;
	currentThreads = Array.isArray(session.threads) ? session.threads : [];
	renderLesson();
	for (const thread of currentThreads) if (!thread.reply) startThreadPolling(thread.threadId);
}

initTheme({ document, storage: localStorage });
document.getElementById("theme-toggle")?.addEventListener("click", () => toggleTheme({ document, storage: localStorage }));
document.getElementById("refresh")?.addEventListener("click", () => loadSession().catch(console.error));
loadSession().catch((error) => {
	document.getElementById("lesson-view").innerHTML = `<section class="sl-error">${escapeHtml(error.message)}</section>`;
});
