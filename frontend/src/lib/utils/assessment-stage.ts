export const ASSESSMENT_STAGE_DEFINITIVE_ECTS = 54;
export const ASSESSMENT_STAGE_CONDITIONAL_ECTS = 42;
export const ASSESSMENT_STAGE_PROJECT_ECTS = 6;

/**
 * An assessment stage is passed definitively at >= 54 completed ECTS, or
 * conditionally at >= 42 completed ECTS with >= 6 ECTS from project modules.
 */
export function assessmentStagePassed(
	completedEcts: number,
	projectEcts: number,
): boolean {
	return (
		completedEcts >= ASSESSMENT_STAGE_DEFINITIVE_ECTS ||
		(completedEcts >= ASSESSMENT_STAGE_CONDITIONAL_ECTS &&
			projectEcts >= ASSESSMENT_STAGE_PROJECT_ECTS)
	);
}
