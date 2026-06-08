export const EXERCISE_ACTIONS = Object.freeze([
	Object.freeze({ action: "struggling", label: "I'm struggling" }),
	Object.freeze({ action: "review_attempt", label: "Review my attempt" }),
]);

export const EXERCISE_ACTION_IDS = new Set(EXERCISE_ACTIONS.map((item) => item.action));

export function defaultExerciseActions() {
	return EXERCISE_ACTIONS.map((item) => ({ ...item }));
}

export function actionLabel(action) {
	return EXERCISE_ACTIONS.find((item) => item.action === action)?.label || EXERCISE_ACTIONS[0].label;
}

export function normalizeStringList(value) {
	if (!Array.isArray(value)) {
		const item = String(value == null ? "" : value).trim();
		return item ? [item] : [];
	}
	return value.map((item) => String(item == null ? "" : item).trim()).filter(Boolean);
}
