import type { Node, Edge } from '@xyflow/svelte';
import type { CurriculumTemplate, ExtendedNodeData } from '../types';
import { 
  COURSES, 
  type PrerequisiteExpression,
  isProgramSpecificRequirement,
  isPrerequisiteRequirement,
  isAndExpression,
  isOrExpression,
  isCreditRequirement,
  isAssessmentStageRequirement
} from '../data/courses';
import { getNodeWidth, getNodeLabel } from './layout';
import { MarkerType } from "@xyflow/svelte";

export function toGraph(template: CurriculumTemplate, selections: Record<string, string>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  
  template.slots.forEach(slot => {
    if (slot.type === "fixed" && slot.courseId) {
      const course = COURSES.find(c => c.id === slot.courseId);
      if (course) {
        nodes.push({
          id: slot.id,
          position: { x: 0, y: 0 },
          type: "custom",
          data: { 
            label: getNodeLabel(course, false),
            slot: slot,
            course: course,
            width: getNodeWidth(course.ects)
          } as ExtendedNodeData,
          style: "",
        });
      }
    } else if (slot.type === "elective" || slot.type === "major") {
      const selectedCourseId = selections[slot.id];
      const selectedCourse = selectedCourseId ? COURSES.find(c => c.id === selectedCourseId) : null;
      
      nodes.push({
        id: slot.id,
        position: { x: 0, y: 0 },
        type: "custom",
        data: { 
          label: selectedCourse ? getNodeLabel(selectedCourse, false) : `${slot.label} (${slot.credits} ECTS)`,
          slot: slot,
          course: selectedCourse,
          isElectiveSlot: true,
          width: getNodeWidth(selectedCourse ? selectedCourse.ects : slot.credits)
        } as ExtendedNodeData,
        style: "",
      });
    }
  });

  const handleCounts: Record<string, { source: number; target: number }> = {};
  
  nodes.forEach(node => {
    const data = node.data as ExtendedNodeData;
    const course = data.course;
    if (!course) {
      handleCounts[node.id] = { source: 0, target: 0 };
      return;
    }
    
    let sourceCount = 0;
    nodes.forEach(otherNode => {
      const otherData = otherNode.data as ExtendedNodeData;
      const otherCourse = otherData.course;
      if (!otherCourse || otherCourse.id === course.id) return;
      
      otherCourse.prereqs.forEach((prereq: PrerequisiteExpression) => {
        if (isProgramSpecificRequirement(prereq)) {
          prereq.requirements.forEach(req => {
            if (isPrerequisiteRequirement(req)) {
              if (req.courses.includes(course.id)) {
                sourceCount++;
              }
            }
          });
        } else if (isPrerequisiteRequirement(prereq)) {
          if (prereq.courses.includes(course.id)) {
            sourceCount++;
          }
        } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
          // for expression trees, we need to recursively check if any operand contains this course
          const checkExpression = (expr: PrerequisiteExpression): boolean => {
            if (isAndExpression(expr) || isOrExpression(expr)) {
              return expr.operands.some(checkExpression);
            } else if (isPrerequisiteRequirement(expr)) {
              return expr.courses.includes(course.id);
            }
            return false;
          };
          if (checkExpression(prereq)) {
            sourceCount++;
          }
        }
      });
    });
    
    let targetCount = 0;
    course.prereqs.forEach((prereq: PrerequisiteExpression) => {
      if (isProgramSpecificRequirement(prereq)) {
        prereq.requirements.forEach(req => {
          if (isPrerequisiteRequirement(req)) {
            const hasAnyCourseInTemplate = req.courses.some(courseId => {
              const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
              const prereqElectiveSlot = template.slots.find(slot => 
                (slot.type === "elective" || slot.type === "major") && 
                selections[slot.id] === courseId
              );
              return prereqSlot !== undefined || prereqElectiveSlot !== undefined;
            });
            if (hasAnyCourseInTemplate) targetCount++;
          }
        });
      } else if (isPrerequisiteRequirement(prereq)) {
        const hasAnyCourseInTemplate = prereq.courses.some(courseId => {
          const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
          const prereqElectiveSlot = template.slots.find(slot => 
            (slot.type === "elective" || slot.type === "major") && 
            selections[slot.id] === courseId
          );
          return prereqSlot !== undefined || prereqElectiveSlot !== undefined;
        });
        if (hasAnyCourseInTemplate) targetCount++;
      } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
        // for expression trees, count ALL courses that exist in the template
        const countExpression = (expr: PrerequisiteExpression): number => {
          if (isPrerequisiteRequirement(expr)) {
            return expr.courses.filter(courseId => {
              const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
              const prereqElectiveSlot = template.slots.find(slot => 
                (slot.type === "elective" || slot.type === "major") && 
                selections[slot.id] === courseId
              );
              return prereqSlot !== undefined || prereqElectiveSlot !== undefined;
            }).length;
          } else if (isAndExpression(expr) || isOrExpression(expr)) {
            return expr.operands.reduce((sum, operand) => sum + countExpression(operand), 0);
          }
          return 0;
        };
        targetCount += countExpression(prereq);
      }
    });
    
    handleCounts[node.id] = { 
      source: Math.min(sourceCount, 4),
      target: Math.min(targetCount, 4)
    };
  });

  nodes.forEach(node => {
    const counts = handleCounts[node.id];
    if (counts) {
      node.data = {
        ...node.data,
        sourceHandles: counts.source,
        targetHandles: counts.target
      };
    }
  });
  
  const edges: Edge[] = [];
  const handleUsage: Record<string, { source: number; target: number }> = {};
  
  nodes.forEach(node => {
    const counts = handleCounts[node.id];
    if (counts) {
      handleUsage[node.id] = { source: 0, target: 0 };
    }
  });
  
  nodes.forEach(node => {
    const data = node.data as ExtendedNodeData;
    const course = data.course;
    if (!course) return;
    
    const sortedPrereqs = [...course.prereqs].sort((a, b) => {
      const getDependencyDepth = (prereq: PrerequisiteExpression) => {
        if (isPrerequisiteRequirement(prereq)) {
          let maxDepth = 0;
          prereq.courses.forEach(courseId => {
            const prereqCourse = COURSES.find(c => c.id === courseId);
            if (prereqCourse) {
              const calculateDepth = (courseId: string, visited = new Set<string>()): number => {
                if (visited.has(courseId)) return 0;
                visited.add(courseId);
                
                const course = COURSES.find(c => c.id === courseId);
                if (!course || course.prereqs.length === 0) return 0;
                
                let maxDepth = 0;
                course.prereqs.forEach(prereq => {
                  if (isPrerequisiteRequirement(prereq)) {
                    prereq.courses.forEach(courseId => {
                      maxDepth = Math.max(maxDepth, calculateDepth(courseId, new Set(visited)) + 1);
                    });
                  } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
                    prereq.operands.forEach(operand => {
                      if (isPrerequisiteRequirement(operand)) {
                        operand.courses.forEach(courseId => {
                          maxDepth = Math.max(maxDepth, calculateDepth(courseId, new Set(visited)) + 1);
                        });
                      }
                    });
                  }
                });
                return maxDepth;
              };
              maxDepth = Math.max(maxDepth, calculateDepth(courseId));
            }
          });
          return maxDepth;
        } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
          let maxDepth = 0;
          prereq.operands.forEach(operand => {
            maxDepth = Math.max(maxDepth, getDependencyDepth(operand));
          });
          return maxDepth;
        }
        return 999;
      };
      
      const depthA = getDependencyDepth(a);
      const depthB = getDependencyDepth(b);
      
      if (depthA !== depthB) {
        return depthB - depthA;
      }
      
      const getPrereqPosition = (prereq: PrerequisiteExpression) => {
        if (isPrerequisiteRequirement(prereq)) {
          let minPosition = 999;
          prereq.courses.forEach(courseId => {
            const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
            if (prereqSlot) {
              const position = prereqSlot.semester * 1000 + template.slots.indexOf(prereqSlot);
              minPosition = Math.min(minPosition, position);
            }
          });
          return minPosition;
        } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
          let minPosition = 999;
          prereq.operands.forEach(operand => {
            minPosition = Math.min(minPosition, getPrereqPosition(operand));
          });
          return minPosition;
        }
        return 999;
      };
      
      return getPrereqPosition(a) - getPrereqPosition(b);
    });
    
    sortedPrereqs.forEach((prereq: PrerequisiteExpression) => {
      if (isPrerequisiteRequirement(prereq)) {
        prereq.courses.forEach(courseId => {
          const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
          if (prereqSlot) {
            // only create edge if prerequisite comes before the dependent course
            const dependentSlot = template.slots.find(slot => slot.id === node.id);
            if (dependentSlot && prereqSlot.semester < dependentSlot.semester) {
              const targetHandleIndex = handleUsage[node.id]?.target || 0;
              const sourceHandleIndex = handleUsage[prereqSlot.id]?.source || 0;
              
              edges.push({
                id: `${prereqSlot.id}=>${node.id}`,
                source: prereqSlot.id,
                sourceHandle: `source-${sourceHandleIndex}`,
                target: node.id,
                targetHandle: `target-${targetHandleIndex}`,
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: false,
                style: "stroke-width: 2px;",
                type: "bezier",
              });

              if (handleUsage[node.id]) handleUsage[node.id].target++;
              if (handleUsage[prereqSlot.id]) handleUsage[prereqSlot.id].source++;
            }
          } else {
            // look for prerequisite in elective slots with selected courses
            const prereqElectiveSlot = template.slots.find(slot => 
              (slot.type === "elective" || slot.type === "major") && 
              selections[slot.id] === courseId
            );
            if (prereqElectiveSlot) {
              // only create edge if prerequisite comes before the dependent course
              const dependentSlot = template.slots.find(slot => slot.id === node.id);
              if (dependentSlot && prereqElectiveSlot.semester < dependentSlot.semester) {
                const targetHandleIndex = handleUsage[node.id]?.target || 0;
                const sourceHandleIndex = handleUsage[prereqElectiveSlot.id]?.source || 0;
                
                edges.push({
                  id: `${prereqElectiveSlot.id}=>${node.id}`,
                  source: prereqElectiveSlot.id,
                  sourceHandle: `source-${sourceHandleIndex}`,
                  target: node.id,
                  targetHandle: `target-${targetHandleIndex}`,
                  markerEnd: { type: MarkerType.ArrowClosed },
                  animated: false,
                  style: "stroke-width: 2px;",
                  type: "bezier",
                });

                if (handleUsage[node.id]) handleUsage[node.id].target++;
                if (handleUsage[prereqElectiveSlot.id]) handleUsage[prereqElectiveSlot.id].source++;
              }
            }
          }
        });
      } else if (isProgramSpecificRequirement(prereq)) {
        prereq.requirements.forEach(req => {
          if (isPrerequisiteRequirement(req)) {
            const availableCourseId = req.courses.find(courseId => {
              const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
              const prereqElectiveSlot = template.slots.find(slot => 
                (slot.type === "elective" || slot.type === "major") && 
                selections[slot.id] === courseId
              );
              return prereqSlot !== undefined || prereqElectiveSlot !== undefined;
            });
            
            if (availableCourseId) {
              // look for prerequisite in fixed slots
              const prereqSlot = template.slots.find(slot => slot.courseId === availableCourseId);
              if (prereqSlot) {
                // only create edge if prerequisite comes before the dependent course
                const dependentSlot = template.slots.find(slot => slot.id === node.id);
                if (dependentSlot && prereqSlot.semester < dependentSlot.semester) {
                  const targetHandleIndex = handleUsage[node.id]?.target || 0;
                  const sourceHandleIndex = handleUsage[prereqSlot.id]?.source || 0;
                  
                  edges.push({
                    id: `${prereqSlot.id}=>${node.id}`,
                    source: prereqSlot.id,
                    sourceHandle: `source-${sourceHandleIndex}`,
                    target: node.id,
                    targetHandle: `target-${targetHandleIndex}`,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    animated: false,
                    style: "stroke-width: 2px;",
                    type: "bezier",
                  });
                  
                  if (handleUsage[node.id]) handleUsage[node.id].target++;
                  if (handleUsage[prereqSlot.id]) handleUsage[prereqSlot.id].source++;
                }
              } else {
                // look for prerequisite in elective slots
                const prereqElectiveSlot = template.slots.find(slot => 
                  (slot.type === "elective" || slot.type === "major") && 
                  selections[slot.id] === availableCourseId
                );
                if (prereqElectiveSlot) {
                  // only create edge if prerequisite comes before the dependent course
                  const dependentSlot = template.slots.find(slot => slot.id === node.id);
                  if (dependentSlot && prereqElectiveSlot.semester < dependentSlot.semester) {
                    const targetHandleIndex = handleUsage[node.id]?.target || 0;
                    const sourceHandleIndex = handleUsage[prereqElectiveSlot.id]?.source || 0;
                    
                    edges.push({
                      id: `${prereqElectiveSlot.id}=>${node.id}`,
                      source: prereqElectiveSlot.id,
                      sourceHandle: `source-${sourceHandleIndex}`,
                      target: node.id,
                      targetHandle: `target-${targetHandleIndex}`,
                      markerEnd: { type: MarkerType.ArrowClosed },
                      animated: false,
                      style: "stroke-width: 2px;",
                      type: "bezier",
                    });
                    
                    if (handleUsage[node.id]) handleUsage[node.id].target++;
                    if (handleUsage[prereqElectiveSlot.id]) handleUsage[prereqElectiveSlot.id].source++;
                  }
                }
              }
            }
          }
        });
      } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
        const createEdgesForExpression = (expr: PrerequisiteExpression) => {
          if (isPrerequisiteRequirement(expr)) {
            expr.courses.forEach(courseId => {
              // look for prerequisite in fixed slots
              const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
              if (prereqSlot) {
                // only create edge if prerequisite comes before the dependent course
                const dependentSlot = template.slots.find(slot => slot.id === node.id);
                if (dependentSlot && prereqSlot.semester < dependentSlot.semester) {
                  const targetHandleIndex = handleUsage[node.id]?.target || 0;
                  const sourceHandleIndex = handleUsage[prereqSlot.id]?.source || 0;
                  
                  edges.push({
                    id: `${prereqSlot.id}=>${node.id}`,
                    source: prereqSlot.id,
                    sourceHandle: `source-${sourceHandleIndex}`,
                    target: node.id,
                    targetHandle: `target-${targetHandleIndex}`,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    animated: false,
                    style: "stroke-width: 2px;",
                    type: "bezier",
                  });

                  if (handleUsage[node.id]) handleUsage[node.id].target++;
                  if (handleUsage[prereqSlot.id]) handleUsage[prereqSlot.id].source++;
                }
              } else {
                // look for prerequisite in elective slots
                const prereqElectiveSlot = template.slots.find(slot => 
                  (slot.type === "elective" || slot.type === "major") && 
                  selections[slot.id] === courseId
                );
                if (prereqElectiveSlot) {
                  // only create edge if prerequisite comes before the dependent course
                  const dependentSlot = template.slots.find(slot => slot.id === node.id);
                  if (dependentSlot && prereqElectiveSlot.semester < dependentSlot.semester) {
                    const targetHandleIndex = handleUsage[node.id]?.target || 0;
                    const sourceHandleIndex = handleUsage[prereqElectiveSlot.id]?.source || 0;
                    
                    edges.push({
                      id: `${prereqElectiveSlot.id}=>${node.id}`,
                      source: prereqElectiveSlot.id,
                      sourceHandle: `source-${sourceHandleIndex}`,
                      target: node.id,
                      targetHandle: `target-${targetHandleIndex}`,
                      markerEnd: { type: MarkerType.ArrowClosed },
                      animated: false,
                      style: "stroke-width: 2px;",
                      type: "bezier",
                    });

                    if (handleUsage[node.id]) handleUsage[node.id].target++;
                    if (handleUsage[prereqElectiveSlot.id]) handleUsage[prereqElectiveSlot.id].source++;
                  }
                }
              }
            });
          } else if (isCreditRequirement(expr) || isAssessmentStageRequirement(expr) || isProgramSpecificRequirement(expr)) {
            // skip non-course prerequisites for edge creation
          } else if (isAndExpression(expr) || isOrExpression(expr)) {
            expr.operands.forEach(createEdgesForExpression);
          }
        };
        
        prereq.operands.forEach(createEdgesForExpression);
      }
    });
  });
  
  return { nodes, edges };
}
