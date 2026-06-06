import { initTheme, toggleTheme } from "./mentor-theme.js";

function $(selector, root = document) {
	return root.querySelector(selector);
}

function readBootstrap() {
	const element = document.getElementById("supermentor-bootstrap");
	if (!element) throw new Error("missing supermentor bootstrap");
	return JSON.parse(element.textContent || "{}");
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

const bootstrap = typeof document === "undefined" ? {} : readBootstrap();
const headers = { "x-supermentor-token": bootstrap.token };
let currentLesson = null;
let currentThreads = [];
let pollTimers = new Map();
let outlineObserver = null;
let visibleOutlineTargets = new Map();

export function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export function slug(value, fallback) {
	return String(value || fallback)
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "") || fallback;
}

function renderInlineMarkdown(text) {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\n/g, "<br>");
}

function languageFromBlock(block = {}) {
	const explicit = block.language || block.lang || block.syntax;
	if (explicit) return String(explicit).toLowerCase();
	const file = String(block.file || "").toLowerCase();
	const ext = file.split(".").pop();
	return {
		js: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		ts: "typescript",
		tsx: "typescript",
		jsx: "javascript",
		json: "json",
		odin: "odin",
		rs: "rust",
		go: "go",
		zig: "zig",
		py: "python",
		css: "css",
		html: "xml",
		md: "markdown",
	}[ext] || "";
}

export function highlightedHtml(code, language, highlighter = globalThis.hljs) {
	const hljs = highlighter;
	if (!hljs) return escapeHtml(code);
	try {
		if (language && hljs.getLanguage(language)) return hljs.highlight(code, { language }).value;
		return hljs.highlightAuto(code).value;
	} catch {
		return escapeHtml(code);
	}
}

function renderFencedCode(part) {
	const info = part.match(/^```([^\n]*)\n?/)?.[1]?.trim() || "";
	const code = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
	const language = info.split(/\s+/)[0] || "";
	return renderCodeBlock({ code, language }, { lineNumbers: false });
}

function renderMarkdown(text) {
	const source = String(text || "").trim();
	if (!source) return "";
	const parts = source.split(/(```[\s\S]*?```)/g);
	return parts
		.map((part) => {
			if (part.startsWith("```")) return renderFencedCode(part);
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
		"walkthrough-step": "Step",
		exercise: "Exercise",
		prediction: "Prediction",
		recap: "Key takeaway",
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

function getErrorMessage(error) {
	if (!(error instanceof Error)) return "The question could not be sent to the agent.";
	const status = error.message.match(/^(\d{3})\b/)?.[1];
	const messages = {
		400: "The submitted question is invalid.",
		403: "This learning session does not allow that action.",
		404: "This discussion thread could not be found.",
		502: "The agent could not receive the question.",
		504: "The agent did not answer in time.",
	};
	return messages[status] || "The question could not be sent to the agent.";
}

function clearComposerError(composer) {
	const errorElement = composer.querySelector(".sm-composer-error");
	errorElement.hidden = true;
	errorElement.textContent = "";
}

function selectedTextInside(block) {
	const selection = window.getSelection?.();
	if (!selection || selection.isCollapsed) return "";
	if (!block.contains(selection.anchorNode) || !block.contains(selection.focusNode)) return "";
	return selection.toString().trim();
}

function renderCodeBlock(block) {
	const code = String(block.code || block.body || "").replace(/\n$/, "");
	const language = languageFromBlock(block);
	const highlighted = highlightedHtml(code, language);
	const languageClass = language ? ` language-${escapeHtml(language)}` : "";
	return `<pre class="sm-code"><code class="hljs${languageClass}">${highlighted}</code></pre>`;
}

function threadsForBlock(blockId) {
	return currentThreads.filter((thread) => thread.question?.blockId === blockId);
}

function renderThread(thread) {
	const question = thread.question || {};
	const reply = thread.reply || null;
	return `<article class="sm-thread" data-thread-id="${escapeHtml(thread.threadId)}">
		<div class="sm-thread-question">
			<strong>Question</strong>
			<p>${renderInlineMarkdown(question.question || "")}</p>
			${question.selection ? `<blockquote>${renderInlineMarkdown(question.selection)}</blockquote>` : ""}
		</div>
		<div class="sm-thread-reply ${reply ? "" : "is-pending"}">
			<strong>${reply ? "Reply" : "Waiting for the agent reply…"}</strong>
			${reply?.markdown ? renderMarkdown(reply.markdown) : ""}
			${Array.isArray(reply?.followups) && reply.followups.length ? `<div class="sm-followups">${reply.followups.map((item) => `<button type="button" data-followup="${escapeHtml(item.kind || item.action || item.label)}">${escapeHtml(item.label || item.kind || "Go deeper")}</button>`).join("")}</div>` : ""}
		</div>
	</article>`;
}

export function isChildBlock(block) {
	return block.type === "code" || block.type === "walkthrough-step" || Array.isArray(block.anchors);
}

export function buildSections(blocks) {
	const sections = [];
	for (const [index, block] of blocks.entries()) {
		const id = block.id || `block-${index + 1}`;
		const normalized = { ...block, id };
		if (!sections.length || !isChildBlock(normalized)) {
			sections.push({ id: `section-${slug(normalized.id, String(sections.length + 1))}`, lead: normalized, children: [] });
			continue;
		}
		sections[sections.length - 1].children.push(normalized);
	}
	return sections;
}

export function resolveAnchors(block, blocks = []) {
	const anchors = Array.isArray(block?.anchors) ? block.anchors : [];
	return anchors.map((anchor) => {
		const raw = String(anchor);
		const [, targetId, start, end] = raw.match(/^([^:]+)(?::(\d+)(?:-(\d+))?)?$/) || [];
		const target = blocks.find((item) => (item.id || "") === targetId) || {};
		return {
			raw,
			blockId: targetId || raw,
			file: target.file || null,
			startLine: start ? Number(start) : target.startLine || null,
			endLine: end ? Number(end) : start ? Number(start) : target.endLine || null,
		};
	});
}

export function buildInlineQuestionPayload({ lesson, bootstrap, blockId, selection, question }) {
	const blocks = Array.isArray(lesson?.blocks) ? lesson.blocks : [];
	const lessonBlock = blocks.find((item) => (item.id || "") === blockId) || {};
	const resolvedAnchors = resolveAnchors(lessonBlock, blocks);
	return {
		lessonId: lesson?.lessonId || lesson?.id || bootstrap?.sessionId,
		blockId,
		anchor: {
			blockId,
			file: lessonBlock.file || resolvedAnchors[0]?.file || null,
			startLine: lessonBlock.startLine || resolvedAnchors[0]?.startLine || null,
			endLine: lessonBlock.endLine || resolvedAnchors[0]?.endLine || null,
			anchors: Array.isArray(lessonBlock.anchors) ? lessonBlock.anchors : [],
			resolvedAnchors,
		},
		selection,
		question,
	};
}

function renderCommentArea(blockId) {
	return `<div class="sm-comment-area">
		<button class="sm-comment-button" type="button" aria-label="Comment on this section" title="Comment on this section"><img src="/assets/icons/comment.svg" alt="" aria-hidden="true"><span>Comment</span></button>
		<div class="sm-composer" hidden>
			<label>Your question about this passage</label>
			<div class="sm-composer-error" role="alert" hidden></div>
			<textarea rows="4" placeholder="Tell me what is unclear, ask for a trace, or request a smaller example…"></textarea>
			<div class="sm-composer-actions"><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="submit">Send</button></div>
		</div>
		<div class="sm-threads">${threadsForBlock(blockId).map(renderThread).join("")}</div>
	</div>`;
}

function renderSubBlock(block) {
	const title = block.title || blockLabel(block.type);
	const body = block.type === "code" ? renderCodeBlock(block) : renderMarkdown(block.body || block.markdown || "");
	const source = block.file ? `<span class="sm-source">${escapeHtml(block.file)}${block.startLine ? `:${block.startLine}${block.endLine ? `-${block.endLine}` : ""}` : ""}</span>` : "";
	return `<section class="sm-subblock sm-subblock-${escapeHtml(block.type || "section")}" id="${escapeHtml(block.id)}" data-block-id="${escapeHtml(block.id)}">
		<div class="sm-subblock-heading"><span>${escapeHtml(blockLabel(block.type))}</span><h3>${escapeHtml(title)}</h3>${source}</div>
		<div class="sm-block-body">${body}</div>
		${renderCommentArea(block.id)}
	</section>`;
}

function renderSection(section, index) {
	const block = section.lead;
	const title = block.title || blockLabel(block.type);
	const body = block.type === "code" ? renderCodeBlock(block) : renderMarkdown(block.body || block.markdown || "");
	const source = block.file ? `<span class="sm-source">${escapeHtml(block.file)}${block.startLine ? `:${block.startLine}${block.endLine ? `-${block.endLine}` : ""}` : ""}</span>` : "";
	return `<article class="sm-section" id="${escapeHtml(section.id)}" data-section-index="${index + 1}">
		<header class="sm-section-header">
			<span class="sm-section-number">${index + 1}</span>
			<div><span class="sm-block-kind">${escapeHtml(blockLabel(block.type))}</span><h2>${escapeHtml(title)}</h2>${source}</div>
		</header>
		<section class="sm-section-lead" id="${escapeHtml(block.id)}" data-block-id="${escapeHtml(block.id)}">
			<div class="sm-block-body">${body}</div>
			${renderCommentArea(block.id)}
		</section>
		${section.children.length ? `<div class="sm-section-children">${section.children.map(renderSubBlock).join("")}</div>` : ""}
	</article>`;
}

function renderOutline(sections) {
	const main = document.querySelector("#lesson-outline .sm-sidebar-main");
	if (!main) return;
	main.innerHTML = `<div class="sm-sidebar-title">Session</div>
		<div class="sm-session-id">${escapeHtml(bootstrap.sessionId)}</div>
		<nav>${sections
			.map((section, index) => {
				const lead = section.lead;
				const children = section.children;
				return `<div class="sm-outline-section">
					<a class="sm-outline-main" href="#${escapeHtml(section.id)}"><span>${index + 1}</span>${escapeHtml(lead.title || blockLabel(lead.type))}</a>
					${children.length ? `<div class="sm-outline-children">${children.map((block) => `<a href="#${escapeHtml(block.id)}"><span>${escapeHtml(blockLabel(block.type))}</span>${escapeHtml(block.title || blockLabel(block.type))}</a>`).join("")}</div>` : ""}
				</div>`;
			})
			.join("")}</nav>`;
}

function renderLesson() {
	if (!currentLesson) return;
	$("#lesson-title").textContent = currentLesson.title || "Supermentor";
	const view = document.getElementById("lesson-view");
	const blocks = Array.isArray(currentLesson.blocks) ? currentLesson.blocks : [];
	const sections = buildSections(blocks);
	view.innerHTML = `${currentLesson.intro ? `<section class="sm-intro">${renderMarkdown(currentLesson.intro)}</section>` : ""}${sections.map(renderSection).join("")}`;
	renderOutline(sections);
	bindLessonEvents(view);
	initOutlineScrollSpy(view);
}

function setActiveOutlineItem(id) {
	const outline = document.getElementById("lesson-outline");
	if (!outline || !id) return;
	outline.querySelectorAll("a.is-active").forEach((item) => item.classList.remove("is-active"));
	outline.querySelectorAll(".sm-outline-section.is-active-parent").forEach((item) => item.classList.remove("is-active-parent"));
	const link = outline.querySelector(`a[href="#${CSS.escape(id)}"]`);
	if (!link) return;
	link.classList.add("is-active");
	link.closest(".sm-outline-section")?.classList.add("is-active-parent");
	link.scrollIntoView({ block: "nearest" });
}

function initOutlineScrollSpy(root) {
	outlineObserver?.disconnect();
	visibleOutlineTargets = new Map();
	const targets = [...root.querySelectorAll(".sm-section[id], .sm-subblock[id]")];
	if (!targets.length) return;
	let activeId = "";
	const activateClosestVisible = () => {
		const visible = [...visibleOutlineTargets.values()]
			.filter((entry) => entry.isIntersecting)
			.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
		const nextId = visible?.target.id || location.hash.slice(1) || targets[0].id;
		if (!nextId || nextId === activeId) return;
		activeId = nextId;
		setActiveOutlineItem(activeId);
	};
	outlineObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) visibleOutlineTargets.set(entry.target.id, entry);
		activateClosestVisible();
	}, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1, 0.4] });
	for (const target of targets) outlineObserver.observe(target);
	setActiveOutlineItem(location.hash.slice(1) || targets[0].id);
}

function blockElementForComposer(button) {
	return button.closest("[data-block-id]");
}

function setActiveContent(element) {
	document.querySelectorAll(".is-active-content").forEach((item) => item.classList.remove("is-active-content"));
	if (!element?.id) return;
	element.classList.add("is-active-content");
	setActiveOutlineItem(element.id);
}

function closestElement(target, selector) {
	const element = target instanceof Element ? target : target?.parentElement;
	return element?.closest(selector) || null;
}

function isInteractiveClick(target) {
	return Boolean(closestElement(target, "button, a, textarea, input, select, label, .sm-composer"));
}

function bindLessonEvents(root) {
	root.addEventListener("click", (event) => {
		if (isInteractiveClick(event.target)) return;
		const target = closestElement(event.target, ".sm-subblock[id], .sm-section-lead[id], .sm-section[id]");
		if (target && root.contains(target)) setActiveContent(target);
	});
	root.querySelectorAll(".sm-comment-button").forEach((button) => {
		button.addEventListener("click", () => {
			const block = blockElementForComposer(button);
			const area = button.closest(".sm-comment-area");
			const composer = area.querySelector(".sm-composer");
			composer.hidden = false;
			clearComposerError(composer);
			const selected = selectedTextInside(block);
			composer.dataset.selection = selected;
			const textarea = composer.querySelector("textarea");
			textarea.focus();
			if (selected && !textarea.value) textarea.placeholder = `Question about: ${selected.slice(0, 160)}`;
		});
	});
	root.querySelectorAll(".sm-composer [data-action='cancel']").forEach((button) => {
		button.addEventListener("click", () => {
			const composer = button.closest(".sm-composer");
			composer.hidden = true;
			composer.querySelector("textarea").value = "";
			delete composer.dataset.selection;
			clearComposerError(composer);
		});
	});
	root.querySelectorAll(".sm-composer [data-action='submit']").forEach((button) => {
		button.addEventListener("click", async () => {
			const block = button.closest("[data-block-id]");
			const composer = button.closest(".sm-composer");
			const textarea = composer.querySelector("textarea");
			const question = textarea.value.trim();
			if (!question) return;
			button.disabled = true;
			try {
				clearComposerError(composer);
				const blockId = block.dataset.blockId;
				const selection = composer.dataset.selection || selectedTextInside(block) || "";
				const payload = buildInlineQuestionPayload({ lesson: currentLesson, bootstrap, blockId, selection, question });
				const result = await api("/api/inline-question", {
					method: "POST",
					body: JSON.stringify(payload),
				});
				currentThreads.push({ threadId: result.threadId, question: { threadId: result.threadId, blockId, question, selection }, reply: null });
				composer.hidden = true;
				textarea.value = "";
				delete composer.dataset.selection;
				renderLesson();
				startThreadPolling(result.threadId);
			} catch (error) {
				const message = getErrorMessage(error);
				const errorElement = composer.querySelector(".sm-composer-error");
				errorElement.textContent = message;
				errorElement.hidden = false;
				errorElement.scrollIntoView({ block: "nearest" });
				composer.querySelector("textarea").focus();
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

function setSidebarCollapsed(collapsed) {
	document.body.classList.toggle("is-sidebar-collapsed", collapsed);
	const button = document.getElementById("sidebar-toggle");
	button?.setAttribute("aria-pressed", String(collapsed));
	try {
		localStorage.setItem("supermentor:sidebar-collapsed", collapsed ? "true" : "false");
	} catch {}
}

function toggleSidebar() {
	setSidebarCollapsed(!document.body.classList.contains("is-sidebar-collapsed"));
}

function initSidebarResize() {
	const resizer = document.getElementById("sidebar-resizer");
	const maxSidebarWidth = () => Math.min(448, window.innerWidth * 0.38);
	const saved = Number(localStorage.getItem("supermentor:sidebar-width"));
	if (Number.isFinite(saved)) document.documentElement.style.setProperty("--sidebar-width", `${clamp(saved, 220, maxSidebarWidth())}px`);
	setSidebarCollapsed(localStorage.getItem("supermentor:sidebar-collapsed") === "true");
	resizer?.addEventListener("dblclick", (event) => {
		if (window.matchMedia("(max-width: 720px)").matches) return;
		event.preventDefault();
		toggleSidebar();
	});
	resizer?.addEventListener("pointerdown", (event) => {
		if (window.matchMedia("(max-width: 720px)").matches || document.body.classList.contains("is-sidebar-collapsed")) return;
		event.preventDefault();
		document.body.classList.add("is-resizing-sidebar");
		console.debug("supermentor sidebar resize start");
		const move = (moveEvent) => {
			const width = clamp(moveEvent.clientX, 220, maxSidebarWidth());
			document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
			localStorage.setItem("supermentor:sidebar-width", String(width));
		};
		const stop = () => {
			document.body.classList.remove("is-resizing-sidebar");
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", stop);
			window.removeEventListener("pointercancel", stop);
			console.debug("supermentor sidebar resize end");
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", stop);
		window.addEventListener("pointercancel", stop);
		move(event);
	});
}

if (typeof document !== "undefined") {
	initTheme({ document, storage: localStorage });
	initSidebarResize();
	document.getElementById("theme-toggle")?.addEventListener("click", () => toggleTheme({ document, storage: localStorage }));
	document.getElementById("sidebar-toggle")?.addEventListener("click", () => toggleSidebar());
	loadSession().catch((error) => {
		document.getElementById("lesson-view").innerHTML = `<section class="sm-error">${escapeHtml(error.message)}</section>`;
	});
}
