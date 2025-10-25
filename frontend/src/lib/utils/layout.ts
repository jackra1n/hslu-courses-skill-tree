import type { Node } from '@xyflow/svelte';
import type { CurriculumTemplate, Course, TemplateSlot } from '$lib/types';
import { COURSES } from '$lib/data/courses';

export function getNodeWidth(credits: number): number {
  const blocks = credits / 3;
  if (blocks === 1) {
    return 150;
  } else {
    return blocks * 150 + (blocks - 1) * 40;
  }
}

export function getNodeLabel(course: Course, showShortNamesOnly: boolean): string {
  if (showShortNamesOnly) {
    return course.id;
  }
  return `${course.label} (${course.id})`;
}

export function layoutSemesterBased(
  template: CurriculumTemplate,
  selections: Record<string, string>,
  nodes: Node[],
): Node[] {
  const templateCourseIds = new Set(template.slots.filter((slot) => slot.courseId).map((slot) => slot.courseId!));

  const semesterGroups: Record<number, TemplateSlot[]> = {};
  template.slots.forEach((slot) => {
    if (!semesterGroups[slot.semester]) {
      semesterGroups[slot.semester] = [];
    }
    semesterGroups[slot.semester].push(slot);
  });

  const prerequisiteChains: Record<string, number> = {};
  const chainGroups: Record<number, string[]> = {};
  let currentChain = 0;
  template.slots.forEach((slot) => {
    if (slot.type === 'fixed' && slot.courseId) {
      const course = COURSES.find((c) => c.id === slot.courseId);
      if (course && course.prerequisites.length > 0) {
        const hasPrereqsInTemplate = course.prerequisites.some((rule) =>
          rule.modules.some((moduleId) => templateCourseIds.has(moduleId)),
        );

        if (hasPrereqsInTemplate) {
          let assignedChain = -1;
          course.prerequisites.forEach((rule) => {
            rule.modules.forEach((moduleId) => {
              if (templateCourseIds.has(moduleId)) {
                const prereqSlot = template.slots.find((s) => s.courseId === moduleId);
                if (prereqSlot && prerequisiteChains[prereqSlot.id] !== undefined) {
                  assignedChain = prerequisiteChains[prereqSlot.id];
                }
              }
            });
          });

          if (assignedChain === -1) {
            assignedChain = currentChain++;
          }

          prerequisiteChains[slot.id] = assignedChain;
          if (!chainGroups[assignedChain]) {
            chainGroups[assignedChain] = [];
          }
          chainGroups[assignedChain].push(slot.id);
        }
      }
    }
  });

  template.slots.forEach((slot) => {
    if (slot.type === 'fixed' && slot.courseId) {
      const course = COURSES.find((c) => c.id === slot.courseId);
      if (course) {
        template.slots.forEach((otherSlot) => {
          if (otherSlot.type === 'fixed' && otherSlot.courseId && prerequisiteChains[otherSlot.id] !== undefined) {
            const otherCourse = COURSES.find((c) => c.id === otherSlot.courseId);
            if (otherCourse) {
              const isPrereq = otherCourse.prerequisites.some((rule) => rule.modules.includes(course.id));

              if (isPrereq && prerequisiteChains[slot.id] === undefined) {
                const chainId = prerequisiteChains[otherSlot.id];
                prerequisiteChains[slot.id] = chainId;
                if (!chainGroups[chainId]) {
                  chainGroups[chainId] = [];
                }
                chainGroups[chainId].push(slot.id);
              }
            }
          }
        });
      }
    }
  });

  Object.keys(semesterGroups).forEach((semester) => {
    const semesterNum = parseInt(semester);
    const slots = semesterGroups[semesterNum];

    slots.sort((a, b) => {
      const chainA = prerequisiteChains[a.id];
      const chainB = prerequisiteChains[b.id];

      const getCourseType = (slot: TemplateSlot) => {
        if (slot.type === 'fixed' && slot.courseId) {
          const course = COURSES.find((c) => c.id === slot.courseId);
          return course?.type || 'Kernmodul';
        }
        return slot.type === 'major' ? 'Major-Modul' : 'Wahl-Modul';
      };

      const typeA = getCourseType(a);
      const typeB = getCourseType(b);

      const getTypePriority = (type: string, hasChain: boolean, slot: TemplateSlot) => {
        if (type === 'Kernmodul' && hasChain) {
          const course = COURSES.find((c) => c.id === slot.courseId);
          const hasConcretePrereqs =
            course &&
            course.prerequisites.some((rule) => rule.modules.some((moduleId) => templateCourseIds.has(moduleId)));
          return hasConcretePrereqs ? 0 : 1;
        }
        if (type === 'Kernmodul') return 2;
        if (type === 'Wahl-Modul' || type === 'Major-Modul') return 3;
        if (type === 'Projektmodul') return 4;
        return 5;
      };

      const priorityA = getTypePriority(typeA, chainA !== undefined, a);
      const priorityB = getTypePriority(typeB, chainB !== undefined, b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      if (chainA !== undefined && chainB !== undefined) {
        if (chainA !== chainB) {
          const getChainLength = (chainId: number) => {
            const chainCourses = chainGroups[chainId] || [];
            return chainCourses.length;
          };

          const lengthA = getChainLength(chainA);
          const lengthB = getChainLength(chainB);

          if (lengthA !== lengthB) {
            if (typeA === 'Projektmodul' && typeB === 'Projektmodul') {
              return lengthA - lengthB;
            }
            return lengthB - lengthA;
          }

          return chainA - chainB;
        }
        return 0;
      }

      if (typeA === 'Projektmodul' && typeB === 'Projektmodul') {
        if (chainA !== undefined) return 1;
        if (chainB !== undefined) return -1;
      } else {
        if (chainA !== undefined) return -1;
        if (chainB !== undefined) return 1;
      }

      return 0;
    });
  });

  return nodes.map((n) => {
    const data = n.data as any;
    const slot = data.slot;
    if (!slot) return n;

    const semesterSlots = semesterGroups[slot.semester] || [];
    const slotIndex = semesterSlots.findIndex((s) => s.id === slot.id);

    if (slotIndex === -1) return n;

    const semesterY = (slot.semester - 1) * 200 + 100;

    let courseX = 100;
    for (let i = 0; i < slotIndex; i++) {
      const prevSlot = semesterSlots[i];
      const prevNode = nodes.find((node) => (node.data as any).slot?.id === prevSlot.id);
      if (prevNode) {
        const prevData = prevNode.data as any;
        const prevCourse = prevData.course;
        const prevWidth = prevData.width || getNodeWidth(prevCourse?.ects || 6);
        courseX += prevWidth + 40;
      }
    }

    return { ...n, position: { x: courseX, y: semesterY } };
  });
}
