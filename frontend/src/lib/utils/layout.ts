import type { Course } from '$lib/types';

export function getNodeWidth(credits: number): number {
  const blocks = Math.max(1, Math.round(credits / 3));
  if (blocks === 1) {
    return 150;
  }
  return blocks * 150 + (blocks - 1) * 40;
}

export function getNodeLabel(course: Course, showShortNamesOnly: boolean): string {
  if (showShortNamesOnly) {
    return course.id;
  }
  return `${course.label} (${course.id})`;
}
