import type { TemplateSlot, CurriculumTemplate } from '$lib/types';

export class TemplateIndex {
  private slotById: Map<string, TemplateSlot>;
  private slotsByCourseId: Map<string, TemplateSlot[]>;
  private semesterBySlotId: Map<string, number>;
  private electiveSelections: Map<string, string>;

  constructor(
    template: CurriculumTemplate,
    selections: Record<string, string>,
    semesterOverrides: Record<string, number> = {}
  ) {
    this.slotById = new Map();
    this.slotsByCourseId = new Map();
    this.semesterBySlotId = new Map();
    this.electiveSelections = new Map(Object.entries(selections));

    template.slots.forEach(slot => {
      this.slotById.set(slot.id, slot);
      const effectiveSemester = semesterOverrides[slot.id] ?? slot.semester;
      this.semesterBySlotId.set(slot.id, effectiveSemester);

      if (slot.type === 'fixed' && slot.courseId) {
        if (!this.slotsByCourseId.has(slot.courseId)) {
          this.slotsByCourseId.set(slot.courseId, []);
        }
        this.slotsByCourseId.get(slot.courseId)!.push(slot);
      }
    });

    this.electiveSelections.forEach((courseId, slotId) => {
      if (!this.slotsByCourseId.has(courseId)) {
        this.slotsByCourseId.set(courseId, []);
      }
      const slot = this.slotById.get(slotId);
      if (slot) {
        this.slotsByCourseId.get(courseId)!.push(slot);
      }
    });
  }

  getSlotById(slotId: string): TemplateSlot | undefined {
    return this.slotById.get(slotId);
  }

  getSemesterBySlotId(slotId: string): number | undefined {
    return this.semesterBySlotId.get(slotId);
  }

  hasCourseInTemplate(courseId: string): boolean {
    return this.slotsByCourseId.has(courseId);
  }

  /**
   * Returns all template slots (fixed or selected elective) that provide the given course
   */
  providerSlotsFor(courseId: string): TemplateSlot[] {
    return this.slotsByCourseId.get(courseId) || [];
  }

  /**
   * Returns provider slots that come before the given dependent slot
   */
  providerSlotsBefore(courseId: string, dependentSlotId: string): TemplateSlot[] {
    const dependentSemester = this.semesterBySlotId.get(dependentSlotId);
    if (dependentSemester === undefined) return [];

    return this.providerSlotsFor(courseId).filter(slot => 
      (this.semesterBySlotId.get(slot.id) ?? slot.semester) < dependentSemester
    );
  }

  /**
   * Returns provider slots that come in the same or earlier semester than the given dependent slot
   */
  providerSlotsBeforeOrSame(courseId: string, dependentSlotId: string): TemplateSlot[] {
    const dependentSemester = this.semesterBySlotId.get(dependentSlotId);
    if (dependentSemester === undefined) return [];

    return this.providerSlotsFor(courseId).filter(slot =>
      (this.semesterBySlotId.get(slot.id) ?? slot.semester) <= dependentSemester
    );
  }

  /**
   * Returns provider slots that come in the same or later semester than the given dependent slot
   */
  providerSlotsAfterOrSame(courseId: string, dependentSlotId: string): TemplateSlot[] {
    const dependentSemester = this.semesterBySlotId.get(dependentSlotId);
    if (dependentSemester === undefined) return [];

    return this.providerSlotsFor(courseId).filter(slot => 
      (this.semesterBySlotId.get(slot.id) ?? slot.semester) >= dependentSemester
    );
  }
}
