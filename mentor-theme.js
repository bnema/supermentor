export function initTheme({ document, storage }) {
	let theme = "dark";
	try {
		const saved = storage?.getItem?.("supermentor:theme");
		if (saved === "dark" || saved === "light") theme = saved;
		else if (!globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches) theme = "light";
	} catch {}
	setTheme({ document, storage }, theme);
	return theme;
}

export function setTheme({ document, storage }, theme) {
	const value = theme === "light" ? "light" : "dark";
	document.documentElement.dataset.theme = value;
	document.documentElement.style.colorScheme = value;
	const highlightTheme = document.getElementById("highlight-theme");
	if (highlightTheme) highlightTheme.href = value === "light" ? "/assets/highlight-github-light.min.css" : "/assets/highlight-github-dark.min.css";
	try {
		storage?.setItem?.("supermentor:theme", value);
	} catch {}
	return value;
}

export function toggleTheme({ document, storage }) {
	const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
	return setTheme({ document, storage }, current === "dark" ? "light" : "dark");
}
