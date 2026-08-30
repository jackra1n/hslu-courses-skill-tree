import * as messages from '$lib/paraglide/messages';

// Module types are German identifiers coming from the HSLU data; map them to
// locale-aware display labels. Unknown types fall back to the raw identifier.

export function moduleTypeLabel(type: string | undefined): string {
	switch (type) {
		case 'Kernmodul':
			return messages.modul_kernmodul();
		case 'Projektmodul':
			return messages.modul_projektmodul();
		case 'Erweiterungsmodul':
			return messages.modul_erweiterungsmodul();
		case 'Major-/Minormodul':
			return messages.modul_major_minor();
		case 'Zusatzmodul':
			return messages.modul_zusatzmodul();
		default:
			return type ?? messages.modul_course();
	}
}

// Short badge label shown on canvas nodes.
export function moduleTypeBadge(type: string | undefined): string {
	switch (type) {
		case 'Kernmodul':
			return messages.badge_kernmodul();
		case 'Projektmodul':
			return messages.badge_projektmodul();
		case 'Erweiterungsmodul':
			return messages.badge_erweiterungsmodul();
		case 'Major-/Minormodul':
			return messages.badge_major_minor();
		case 'Zusatzmodul':
			return messages.badge_zusatzmodul();
		default:
			return messages.badge_default();
	}
}
