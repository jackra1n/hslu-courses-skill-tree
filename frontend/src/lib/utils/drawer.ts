export const DRAWER_OVERLAY_QUERY = '(max-width: 1279px)';

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(element) =>
			element.tabIndex >= 0 &&
			!element.matches(':disabled') &&
			element.getClientRects().length > 0,
	);
}

export function trapTabFocus(
	event: KeyboardEvent,
	container: HTMLElement,
): void {
	if (event.key !== 'Tab') return;
	const focusable = focusableElements(container);
	const first = focusable[0];
	const last = focusable.at(-1);
	if (!first || !last) return;

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}
