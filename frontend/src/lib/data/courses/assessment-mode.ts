import * as m from '$lib/paraglide/messages';
import type { AssessmentMode } from '../catalog/catalog-types';

export function assessmentModeLabel(mode: AssessmentMode): string {
	switch (mode) {
		case 'coursework':
			return m.assessment_coursework();
		case 'written_exam':
			return m.assessment_written_exam();
		case 'oral_exam':
			return m.assessment_oral_exam();
		case 'electronic_exam':
			return m.assessment_electronic_exam();
	}
}
