import * as m from '$lib/paraglide/messages';

// Module types are German identifiers coming from the HSLU data; map them to
// locale-aware display labels. Unknown types fall back to the raw identifier.

export function moduleTypeLabel(type: string | undefined): string {
	switch (type) {
		case 'Kernmodul':
			return m.modul_kernmodul();
		case 'Projektmodul':
			return m.modul_projektmodul();
		case 'Erweiterungsmodul':
			return m.modul_erweiterungsmodul();
		case 'Major-/Minormodul':
			return m.modul_major_minor();
		case 'Zusatzmodul':
			return m.modul_zusatzmodul();
		default:
			return type ?? m.modul_course();
	}
}

// Short badge label shown on canvas nodes.
export function moduleTypeBadge(type: string | undefined): string {
	switch (type) {
		case 'Kernmodul':
			return m.badge_kernmodul();
		case 'Projektmodul':
			return m.badge_projektmodul();
		case 'Erweiterungsmodul':
			return m.badge_erweiterungsmodul();
		case 'Major-/Minormodul':
			return m.badge_major_minor();
		case 'Zusatzmodul':
			return m.badge_zusatzmodul();
		default:
			return m.badge_default();
	}
}
