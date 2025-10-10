<script lang="ts">
  import { onMount } from "svelte";
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type Edge,
    type Node,
    MarkerType,
    Position,
    type OnMove,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import ELK from "elkjs/lib/elk.bundled.js";
  
  import { 
    COURSES, 
    type Course, 
    type Status, 
    type AdvancedPrerequisite, 
    calculateCreditsCompleted, 
    calculateCreditsAttended, 
    isCreditRequirement, 
    isProgramSpecificRequirement, 
    isPrerequisiteRequirement, 
    isAdvancedPrerequisite, 
    type CurriculumTemplate, 
    type TemplateSlot, 
    AVAILABLE_TEMPLATES, 
    getTemplateById, 
    calculateTotalCredits, 
    getTemplatesByProgram, 
    getAvailablePlans 
  } from '$lib/data/courses';
  import { theme } from '$lib/stores/theme';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';
  import SemesterDivider from '$lib/components/SemesterDivider.svelte';

  type ExtendedNodeData = {
    label: string;
    slot?: TemplateSlot;
    course?: Course;
    isElectiveSlot?: boolean;
    width?: number;
  };

  function evaluatePrerequisite(
    prereq: string | AdvancedPrerequisite,
    attended: Set<string>,
    completed: Set<string>
  ): boolean {
    if (typeof prereq === 'string') {
      if (prereq === "assessmentstufe bestanden") {
        return completed.size >= 6; // approximate threshold
      }
      return attended.has(prereq) || completed.has(prereq);
    }

    if (isCreditRequirement(prereq)) {
      if (prereq.moduleType) {
        return calculateCreditsCompleted(completed, prereq.moduleType) >= prereq.minCredits;
      } else {
        return calculateCreditsAttended(attended, completed) >= prereq.minCredits;
      }
    }
    
    if (isProgramSpecificRequirement(prereq)) {
      return prereq.requirements.every(req => evaluatePrerequisite(req, attended, completed));
    }

    if (isPrerequisiteRequirement(prereq)) {
      const { courses, requirement } = prereq;
      
      return courses.some(courseId => {
        if (requirement === "besucht") {
          return attended.has(courseId) || completed.has(courseId);
        } else if (requirement === "bestanden") {
          return completed.has(courseId);
        }
        return false;
      });
    }

    return false;
  }

  function computeStatuses(
    template: CurriculumTemplate,
    selections: Record<string, string>,
    attended: Set<string>,
    completed: Set<string>
  ): Record<string, Status> {
    const s: Record<string, Status> = {};
    
    template.slots.forEach(slot => {
      if (slot.type === "fixed" && slot.courseId) {
        const course = COURSES.find(c => c.id === slot.courseId);
        if (course) {
          if (completed.has(course.id)) {
            s[slot.id] = "completed";
          } else if (course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed))) {
            s[slot.id] = "available";
          } else {
            s[slot.id] = "locked";
          }
        }
      } else if (slot.type === "elective" || slot.type === "major") {
        const selectedCourseId = selections[slot.id];
        if (selectedCourseId) {
          const course = COURSES.find(c => c.id === selectedCourseId);
          if (course) {
            if (completed.has(course.id)) {
              s[slot.id] = "completed";
            } else if (course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed))) {
              s[slot.id] = "available";
            } else {
              s[slot.id] = "locked";
            }
          }
        } else {
          s[slot.id] = "available";
        }
      }
    });
    
    return s;
  }

  function getNodeLabel(course: Course): string {
    if (showShortNamesOnly) {
      return course.id;
    }
    return `${course.label} (${course.id})`;
  }

  function getNodeWidth(credits: number): number {
    const blocks = credits / 3;
    if (blocks === 1) {
      return 150;
    } else {
      return (blocks * 150) + ((blocks - 1) * 40);
    }
  }

  function toGraph(template: CurriculumTemplate, selections: Record<string, string>): { nodes: Node[]; edges: Edge[] } {
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
              label: getNodeLabel(course),
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
            label: selectedCourse ? getNodeLabel(selectedCourse) : `${slot.label} (${slot.credits} ECTS)`,
            slot: slot,
            course: selectedCourse,
            isElectiveSlot: true,
            width: getNodeWidth(selectedCourse ? selectedCourse.ects : slot.credits)
          } as ExtendedNodeData,
          style: "",
        });
      }
    });
    
    const edges: Edge[] = [];
    
    nodes.forEach(node => {
      const data = node.data as ExtendedNodeData;
      const course = data.course;
      if (!course) return;
      
      course.prereqs.forEach((prereq: string | AdvancedPrerequisite) => {
        if (typeof prereq === 'string') {
          if (prereq === "assessmentstufe bestanden") {
            return;
          }
          const prereqSlot = template.slots.find(slot => slot.courseId === prereq);
          if (prereqSlot) {
            edges.push({
              id: `${prereqSlot.id}=>${node.id}`,
              source: prereqSlot.id,
              sourceHandle: "source",
              target: node.id,
              targetHandle: "target",
              markerEnd: { type: MarkerType.ArrowClosed },
              animated: false,
              style: "stroke-width: 2px;",
              type: "smoothstep",
            });
          }
        } else if (isProgramSpecificRequirement(prereq)) {
          prereq.requirements.forEach(req => {
            if (isPrerequisiteRequirement(req)) {
              req.courses.forEach(courseId => {
                const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
                if (prereqSlot) {
                  edges.push({
                    id: `${prereqSlot.id}=>${node.id}`,
                    source: prereqSlot.id,
                    sourceHandle: "source",
                    target: node.id,
                    targetHandle: "target",
                    markerEnd: { type: MarkerType.ArrowClosed },
                    animated: false,
                    style: "stroke-width: 2px;",
                    type: "smoothstep",
                  });
                }
              });
            }
          });
        } else if (isPrerequisiteRequirement(prereq)) {
          prereq.courses.forEach(courseId => {
            const prereqSlot = template.slots.find(slot => slot.courseId === courseId);
            if (prereqSlot) {
              edges.push({
                id: `${prereqSlot.id}=>${node.id}`,
                source: prereqSlot.id,
                sourceHandle: "source",
                target: node.id,
                targetHandle: "target",
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: false,
                style: "stroke-width: 2px;",
                type: "smoothstep",
              });
            }
          });
        }
      });
    });
    
    return { nodes, edges };
  }

  let nodes: Node[] = $state([]);
  let edges: Edge[] = $state([]);
  let selection: Course | null = $state(null);
  let attended = $state(new Set<string>());
  let completed = $state(new Set<string>());
  let statuses: Record<string, Status> = $state({});
  let showAssessmentInfo = $state(false);
  let showShortNamesOnly = $state(false);
  let useELKLayout = $state(false);
  let showMoreOptions = $state(false);
  let showCourseTypeBadges = $state(false);
  
  let currentTemplate: CurriculumTemplate = $state(AVAILABLE_TEMPLATES[0]);
  let userSelections: Record<string, string> = $state({});
  let selectedPlan: string = $state(AVAILABLE_TEMPLATES[0].plan);
  
  const nodeTypes = {
    custom: CustomNode
  };
  
  const processedNodes = $derived(nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      showCourseTypeBadges
    }
  })));
  
  let viewport = $state({ x: 0, y: 0, zoom: 1 });
  
  const handleMove: OnMove = (event, viewportData) => {
    viewport = viewportData;
  };

  async function layoutELK() {
    const elk = new ELK();
    
    const elkGraph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "100",
        "elk.spacing.edgeNode": "20",
        "elk.layered.spacing.nodeNodeBetweenLayers": "150",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.edgeEdge": "20"
      },
      children: nodes.map(node => {
        const data = node.data as ExtendedNodeData;
        const slot = data.slot;
        const course = data.course;
        const nodeWidth = data.width || getNodeWidth(course?.ects || slot?.credits || 6);
        return {
          id: node.id,
          width: nodeWidth,
          height: 64,
          layoutOptions: {
            "elk.priority": String(slot?.semester || 1)
          }
        };
      }),
      edges: edges.map(edge => ({
        id: edge.id,
        sources: [edge.source as string],
        targets: [edge.target as string]
      }))
    };

    try {
      const layoutedGraph = await elk.layout(elkGraph);
      
      const nodePositions: Record<string, { x: number; y: number }> = {};
      
      layoutedGraph.children?.forEach(node => {
        nodePositions[node.id] = {
          x: (node as any).x || 0,
          y: (node as any).y || 0
        };
      });

      nodes = nodes.map((n) => {
        const position = nodePositions[n.id] || { x: 0, y: 0 };
        return { ...n, position };
      });
    } catch (error) {
      console.error("ELK layout failed:", error);
      layoutSemesterBased(currentTemplate, userSelections);
    }
  }

  function layoutSemesterBased(template: CurriculumTemplate, selections: Record<string, string>) {
    const semesterGroups: Record<number, TemplateSlot[]> = {};
    template.slots.forEach(slot => {
      if (!semesterGroups[slot.semester]) {
        semesterGroups[slot.semester] = [];
      }
      semesterGroups[slot.semester].push(slot);
    });

    nodes = nodes.map((n) => {
      const data = n.data as ExtendedNodeData;
      const slot = data.slot;
      if (!slot) return n;

      const semesterSlots = semesterGroups[slot.semester] || [];
      const slotIndex = semesterSlots.findIndex(s => s.id === slot.id);
      
      const semesterY = (slot.semester - 1) * 200 + 100;
      
      let courseX = 100;
      for (let i = 0; i < slotIndex; i++) {
        const prevSlot = semesterSlots[i];
        const prevNode = nodes.find(node => (node.data as ExtendedNodeData).slot?.id === prevSlot.id);
        if (prevNode) {
          const prevData = prevNode.data as ExtendedNodeData;
          const prevCourse = prevData.course;
          const prevWidth = prevData.width || getNodeWidth(prevCourse?.ects || prevSlot.credits || 6);
          courseX += prevWidth + 40; 
        }
      }
      
      return { ...n, position: { x: courseX, y: semesterY } };
    });
  }

  function updateNodeLabels() {
    nodes = nodes.map((n) => {
      const data = n.data as ExtendedNodeData;
      const slot = data.slot;
      const course = data.course;
      
      if (slot && course) {
        return { ...n, data: { ...data, label: getNodeLabel(course) } };
      } else if (slot && (slot.type === "elective" || slot.type === "major")) {
        const selectedCourseId = userSelections[slot.id];
        const selectedCourse = selectedCourseId ? COURSES.find(c => c.id === selectedCourseId) : null;
        const label = selectedCourse ? getNodeLabel(selectedCourse) : `${slot.label} (${slot.credits} ECTS)`;
        return { ...n, data: { ...data, label, course: selectedCourse } };
      }
      
      return n;
    });
  }

  function applyStatuses() {
    statuses = computeStatuses(currentTemplate, userSelections, attended, completed);
    nodes = nodes.map((n) => {
      const s = statuses[n.id];
      const data = n.data as ExtendedNodeData;
      const slot = data.slot;
      const course = data.course;
      const isElectiveSlot = data.isElectiveSlot;
      
      const isAttended = course ? attended.has(course.id) : false;
      const isCompleted = course ? completed.has(course.id) : false;
      const isSelected = selection?.id === n.id;
      
      const nodeWidth = data.width || getNodeWidth(course?.ects || slot?.credits || 6);
      let styleStr = `border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: ${nodeWidth}px; width: ${nodeWidth}px; font-family: Inter, sans-serif; transition: all 0.2s; `;

      if (isSelected) {
        styleStr += "border-width: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0,0,0,0.1); transform: scale(1.05); ";
      } else {
        styleStr += "border-width: 2px; ";
      }
      
      if (isElectiveSlot) {
        styleStr += "background: rgb(var(--bg-secondary)); border-color: #3b82f6; color: rgb(var(--text-primary)); border-style: dashed; ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (s === "completed") {
        styleStr += "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (isAttended) {
        styleStr += "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (s === "available") {
        styleStr += "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else {
        styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); opacity: 0.6;";
      }
      return { ...n, style: styleStr };
    });
    
    edges = edges.map((e) => {
      let selectedSlotId = selection?.id;
      if (selection && !selection.id.startsWith('elective') && !selection.id.startsWith('major')) {
        const selectedSlot = currentTemplate.slots.find(slot => slot.courseId === selection!.id);
        selectedSlotId = selectedSlot?.id;
      }
      
      const isSelected = selectedSlotId === e.source || selectedSlotId === e.target;
      const isPrerequisite = selectedSlotId === e.target;
      const isDependent = selectedSlotId === e.source;
      
      let edgeStyle = "stroke-width: 2px; transition: all 0.2s; ";
      let markerEnd = e.markerEnd;
      
      if (isSelected) {
        if (isPrerequisite) {
          edgeStyle += "stroke: rgb(245 158 11); stroke-width: 3px; stroke-dasharray: 5,5; ";
          markerEnd = { type: MarkerType.ArrowClosed, color: "rgb(245 158 11)" };
        } else if (isDependent) {
          edgeStyle += "stroke: rgb(59 130 246); stroke-width: 3px; ";
          markerEnd = { type: MarkerType.ArrowClosed, color: "rgb(59 130 246)" };
        }
      } else {
        edgeStyle += "stroke: rgb(var(--border-primary)); ";
        markerEnd = { type: MarkerType.ArrowClosed };
      }
      
      return {
        ...e,
        animated: statuses[e.target as string] === "available",
        style: edgeStyle,
        markerEnd,
      };
    });
    
    if (selection) {
      selection = { ...selection };
    }
  }
  
  function markAttended(courseId: string) {
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;
    
    const prereqsMet = course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed));
    if (!prereqsMet) return;
    
    if (attended.has(course.id)) {
      attended.delete(course.id);
    } else {
      attended.add(course.id);
    }
    localStorage.setItem("attendedCourses", JSON.stringify([...attended]));
    applyStatuses();
  }
  
  function markCompleted(courseId: string) {
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;

    const prereqsMet = course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed));
    if (!prereqsMet) return;
    
    if (completed.has(course.id)) {
      completed.delete(course.id);
    } else {
      completed.add(course.id);
      attended.delete(course.id);
    }
    localStorage.setItem("attendedCourses", JSON.stringify([...attended]));
    localStorage.setItem("completedCourses", JSON.stringify([...completed]));
    applyStatuses();
  }

  function handleNodeClick(evt: {
    node: Node;
    event: MouseEvent | TouchEvent;
  }) {
    const node = evt.node;
    if (!node) return;
    
    const data = node.data as ExtendedNodeData;
    const slot = data.slot;
    const course = data.course;
    const isElectiveSlot = data.isElectiveSlot;
    
    if (isElectiveSlot && slot) {
      selection = { 
        id: slot.id, 
        label: slot.label, 
        ects: slot.credits, 
        prereqs: [],
        type: slot.type === "major" ? "Erweiterungsmodul" : "Erweiterungsmodul"
      } as Course;
    } else if (course) {
      selection = course;
    }
    
    applyStatuses();
  }

  function switchTemplate(templateId: string) {
    const template = getTemplateById(templateId);
    if (!template) return;
    
    currentTemplate = template;
    selectedPlan = template.plan;
    localStorage.setItem("currentTemplate", templateId);
    localStorage.setItem("selectedPlan", selectedPlan);
    
    const g = toGraph(currentTemplate, userSelections);
    nodes = g.nodes;
    edges = g.edges;
    
    if (useELKLayout) {
      layoutELK();
    } else {
      layoutSemesterBased(currentTemplate, userSelections);
    }
    
    applyStatuses();
  }

  function switchPlan(plan: string) {
    const template = getTemplatesByProgram(currentTemplate.studiengang, currentTemplate.modell)
      .find(t => t.plan === plan);
    if (!template) return;
    
    switchTemplate(template.id);
  }

  function selectCourseForSlot(slotId: string, courseId: string) {
    userSelections[slotId] = courseId;
    localStorage.setItem("userSelections", JSON.stringify(userSelections));
    
    const g = toGraph(currentTemplate, userSelections);
    nodes = g.nodes;
    edges = g.edges;
    
    if (useELKLayout) {
      layoutELK();
    } else {
      layoutSemesterBased(currentTemplate, userSelections);
    }
    
    applyStatuses();
  }

  function clearSlotSelection(slotId: string) {
    delete userSelections[slotId];
    localStorage.setItem("userSelections", JSON.stringify(userSelections));
    
    const g = toGraph(currentTemplate, userSelections);
    nodes = g.nodes;
    edges = g.edges;
    
    if (useELKLayout) {
      layoutELK();
    } else {
      layoutSemesterBased(currentTemplate, userSelections);
    }
    
    applyStatuses();
  }

  onMount(async () => {
    const savedAttended = localStorage.getItem("attendedCourses");
    if (savedAttended) {
      attended = new Set<string>(JSON.parse(savedAttended));
    }
    
    const savedCompleted = localStorage.getItem("completedCourses");
    if (savedCompleted) {
      completed = new Set<string>(JSON.parse(savedCompleted));
    }

    const savedSelections = localStorage.getItem("userSelections");
    if (savedSelections) {
      userSelections = JSON.parse(savedSelections);
    }

    const savedTemplate = localStorage.getItem("currentTemplate");
    if (savedTemplate) {
      const template = getTemplateById(savedTemplate);
      if (template) {
        currentTemplate = template;
        selectedPlan = template.plan;
      }
    }

    const savedPlan = localStorage.getItem("selectedPlan");
    if (savedPlan) {
      selectedPlan = savedPlan;
      if (!savedTemplate) {
        const template = getTemplatesByProgram(currentTemplate.studiengang, currentTemplate.modell)
          .find(t => t.plan === savedPlan);
        if (template) {
          currentTemplate = template;
        }
      }
    }

    const g = toGraph(currentTemplate, userSelections);
    nodes = g.nodes;
    edges = g.edges;
    console.log("Initial nodes:", nodes.length);
    console.log("Initial edges:", edges.length);
    
    if (useELKLayout) {
      await layoutELK();
    } else {
      layoutSemesterBased(currentTemplate, userSelections);
    }
    console.log("After layout:", nodes.length);
    applyStatuses();
  });
</script>

<div class="font-sans h-screen flex flex-col">
  <header class="border-b border-border-primary bg-bg-primary px-6 py-4 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-text-primary">HSLU Course Skill Tree</h1>
      <p class="text-sm text-text-secondary mt-1">Track your progress through courses</p>
    </div>
    <div class="flex items-center gap-4">
      <!-- Template Selectors -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <label for="program-select" class="text-sm font-medium text-text-primary">Program:</label>
          <select 
            id="program-select"
            value={currentTemplate.studiengang}
            onchange={(e) => {
              const target = e.target as HTMLSelectElement;
              const studiengang = target.value;
              const template = AVAILABLE_TEMPLATES.find(t => t.studiengang === studiengang && t.modell === currentTemplate.modell);
              if (template) switchTemplate(template.id);
            }}
            class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Informatik">Informatik</option>
          </select>
        </div>
        
        <div class="flex items-center gap-2">
          <label for="model-select" class="text-sm font-medium text-text-primary">Model:</label>
          <select 
            id="model-select"
            value={currentTemplate.modell}
            onchange={(e) => {
              const target = e.target as HTMLSelectElement;
              const modell = target.value as "fulltime" | "parttime";
              const template = getTemplatesByProgram(currentTemplate.studiengang, modell)
                .find(t => t.plan === selectedPlan) || getTemplatesByProgram(currentTemplate.studiengang, modell)[0];
              if (template) switchTemplate(template.id);
            }}
            class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fulltime">Full-time</option>
            <option value="parttime">Part-time</option>
          </select>
        </div>
        
        <div class="flex items-center gap-2">
          <label for="plan-select" class="text-sm font-medium text-text-primary">Plan:</label>
          <select 
            id="plan-select"
            value={selectedPlan}
            onchange={(e) => {
              const target = e.target as HTMLSelectElement;
              const plan = target.value;
              switchPlan(plan);
            }}
            class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {#each getAvailablePlans(currentTemplate.studiengang, currentTemplate.modell) as plan}
              <option value={plan}>{plan}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Credit Display -->
      <div class="flex items-center gap-4 text-sm text-text-secondary">
        <div class="flex items-center gap-1.5">
          <div class="i-lucide-book-open"></div>
          <span>{calculateTotalCredits(currentTemplate, userSelections)} ECTS Total</span>
        </div>
      </div>

      <!-- More Options Toggle -->
      <button 
        onclick={() => showMoreOptions = !showMoreOptions}
        class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <div class="i-lucide-settings"></div>
        More Options
      </button>
      
      <ThemeSwitcher />
    </div>
  </header>
  
  {#if showMoreOptions}
    <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-lg font-bold text-text-primary mb-3">Additional Options</h2>
        <div class="flex items-center gap-4">
          <button 
            onclick={() => showAssessmentInfo = !showAssessmentInfo}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700"
          >
            <div class="i-lucide-info"></div>
            Assessment Info
          </button>
          <button 
            onclick={() => {
              showShortNamesOnly = !showShortNamesOnly;
              updateNodeLabels();
            }}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {showShortNamesOnly 
              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-800 dark:text-green-100 dark:hover:bg-green-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            }"
          >
            <div class="i-lucide-toggle-left"></div>
            {showShortNamesOnly ? 'Short Names' : 'Full Names'}
          </button>
          <button 
            onclick={async () => {
              useELKLayout = !useELKLayout;
              if (useELKLayout) {
                await layoutELK();
              } else {
                layoutSemesterBased(currentTemplate, userSelections);
              }
            }}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {useELKLayout 
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-800 dark:text-purple-100 dark:hover:bg-purple-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            }"
          >
            <div class="i-lucide-network"></div>
            {useELKLayout ? 'ELK Layout' : 'Semester Layout'}
          </button>
          <button 
            onclick={() => showCourseTypeBadges = !showCourseTypeBadges}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {showCourseTypeBadges 
              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            }"
          >
            <div class="i-lucide-tag"></div>
            Course Type Badges
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if showAssessmentInfo}
    <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-lg font-bold text-text-primary mb-3">Assessment Stage Rules</h2>
        <div class="space-y-4 text-sm text-text-secondary">
          <div>
            <h3 class="font-semibold text-text-primary mb-2">Passing Requirements:</h3>
            <ul class="space-y-1 ml-4">
              <li><strong>Definitiv bestanden:</strong> 54 credits achieved</li>
              <li><strong>Bedingt bestanden:</strong> ≥42 credits with ≥6 credits from project modules</li>
              <li><strong>Nicht bestanden:</strong> &lt;42 credits or &lt;6 credits from project modules</li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-text-primary mb-2">Consequences:</h3>
            <ul class="space-y-1 ml-4">
              <li><strong>Bedingt bestanden:</strong> Can continue studying, but must earn remaining credits within 5 semesters</li>
              <li><strong>Nicht bestanden:</strong> Cannot continue to intermediate stage</li>
              <li>Students who don't pass definitively within 5 semesters are excluded from the bachelor program</li>
            </ul>
          </div>
          <div class="text-xs text-text-tertiary">
            <p><strong>Note:</strong> In this skill tree, "assessmentstufe bestanden" is considered met when you have completed 6+ courses. This is an approximation for demonstration purposes.</p>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="flex-1 grid grid-cols-[1fr_400px] min-h-0">
    <div class="relative">
      <SvelteFlow nodes={processedNodes} {edges} {nodeTypes} onnodeclick={handleNodeClick} onmove={handleMove} nodesDraggable={false} nodesConnectable={false} fitView colorMode={$theme === 'system' ? 'system' : $theme}>
      <svg 
        class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <g transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})">
          <SemesterDivider semester={1} yPosition={250} {viewport} {currentTemplate} {userSelections} />
          <SemesterDivider semester={2} yPosition={450} {viewport} {currentTemplate} {userSelections} />
          <SemesterDivider semester={3} yPosition={650} {viewport} {currentTemplate} {userSelections} />
          <SemesterDivider semester={4} yPosition={850} {viewport} {currentTemplate} {userSelections} />
          <SemesterDivider semester={5} yPosition={1050} {viewport} {currentTemplate} {userSelections} />
          <SemesterDivider semester={6} yPosition={1250} {viewport} {currentTemplate} {userSelections} />
        </g>
      </svg>
        <MiniMap />
        <Controls />
        <Background gap={16} />
      </SvelteFlow>
    </div>

    <aside class="border-l border-border-primary bg-bg-secondary overflow-y-auto">
      {#if selection}
        {@const isElectiveSlot = selection.id.startsWith('elective') || selection.id.startsWith('major')}
        {@const isLocked = !isElectiveSlot && statuses[selection.id] === "locked"}
        {@const isAttended = !isElectiveSlot && attended.has(selection.id)}
        {@const isCompleted = !isElectiveSlot && completed.has(selection.id)}
        
        <div class="p-6 space-y-6">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xl font-bold text-text-primary">{selection.label}</h2>
              <button 
                onclick={() => {
                  selection = null;
                  applyStatuses();
                }}
                class="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-all"
                title="Deselect course"
              >
                <div class="i-lucide-x w-4 h-4"></div>
              </button>
            </div>
            
            <div class="flex items-center gap-4 text-sm text-text-secondary mb-2">
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-book-open text-text-secondary"></div>
                <span>{selection.ects} ECTS</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-calendar text-text-secondary"></div>
                <span>Semester {isElectiveSlot ? (currentTemplate.slots.find(s => s.id === selection!.id)?.semester || '?') : (currentTemplate.slots.find(s => s.courseId === selection!.id)?.semester || '?')}</span>
              </div>
            </div>
            
            {#if selection.type}
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-100 rounded-md text-sm font-medium">
                <div class="i-lucide-layers text-purple-600 dark:text-purple-400"></div>
                {selection.type}
              </div>
            {/if}
          </div>

          {#if isElectiveSlot}
            <!-- Course Selection for Elective Slot -->
            <div class="border-t border-border-primary pt-4">
              <h3 class="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <div class="i-lucide-book-plus text-text-secondary"></div>
                Select Course
              </h3>
              <div class="space-y-3">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="elective-course-select" class="text-sm font-medium text-text-primary">
                      Choose a course for this slot
                    </label>
                    {#if selection && userSelections[selection.id]}
                      <button 
                        onclick={() => {
                          if (selection) clearSlotSelection(selection.id);
                        }}
                        class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Clear
                      </button>
                    {/if}
                  </div>
                  <select 
                    id="elective-course-select"
                    value={selection ? userSelections[selection.id] || '' : ''}
                    onchange={(e) => {
                      const target = e.target as HTMLSelectElement | null;
                      if (!target || !selection) return;
                      const courseId = target.value;
                      if (courseId) {
                        selectCourseForSlot(selection.id, courseId);
                      } else {
                        clearSlotSelection(selection.id);
                      }
                    }}
                    class="w-full px-3 py-2 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a course...</option>
                    {#each COURSES as course}
                      <option value={course.id}>{course.label} ({course.id}) - {course.ects} ECTS</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>
          {:else}
            <!-- Course Details for Fixed Courses -->
            <div class="border-t border-border-primary pt-4">
              <h3 class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                <div class="i-lucide-git-branch text-text-secondary"></div>
                Prerequisites
              </h3>
              {#if selection.prereqs && selection.prereqs.length > 0}
                <ul class="space-y-1.5">
                  {#each selection.prereqs as prereq}
                    {@const prereqMet = evaluatePrerequisite(prereq, attended, completed)}
                    <li class="flex items-start gap-2 text-sm">
                      <div class="{prereqMet ? 'i-lucide-check-circle text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
                      <div class="flex-1">
                        {#if typeof prereq === 'string'}
                          {@const prereqCourse = COURSES.find(c => c.id === prereq)}
                          <span class={prereqMet ? 'text-text-primary' : 'text-text-secondary'}>
                            {prereq === "assessmentstufe bestanden" ? "Assessment Stage Passed" : (prereqCourse?.label || prereq)}
                          </span>
                          {#if prereq === "assessmentstufe bestanden"}
                            <div class="text-xs text-text-tertiary">
                              ({completed.size}/6+ courses completed)
                            </div>
                          {/if}
                        {:else if isCreditRequirement(prereq)}
                          <!-- Credit Requirements -->
                          <div class={prereqMet ? 'text-text-primary' : 'text-text-secondary'}>
                            <span class="font-medium">
                              {prereq.moduleType ? `${prereq.moduleType} Credits` : 'Total Credits'}:
                            </span>
                            <span class="ml-2">
                              {prereq.moduleType 
                                ? `${calculateCreditsCompleted(completed, prereq.moduleType)}/${prereq.minCredits} ECTS`
                                : `${calculateCreditsAttended(attended, completed)}/${prereq.minCredits} ECTS`
                              }
                            </span>
                          </div>
                        {:else if isProgramSpecificRequirement(prereq)}
                          <!-- Program-Specific Requirements -->
                          <div class={prereqMet ? 'text-text-primary' : 'text-text-secondary'}>
                            <span class="font-medium">{prereq.program}:</span>
                            <div class="ml-2 mt-1 space-y-1">
                              {#each prereq.requirements as req}
                                {@const reqMet = evaluatePrerequisite(req, attended, completed)}
                                <div class="flex items-center gap-1.5 text-xs">
                                  <div class="{reqMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                                  <span class={reqMet ? 'text-text-primary' : 'text-text-secondary'}>
                                    {#if isAdvancedPrerequisite(req) && isCreditRequirement(req)}
                                      {req.moduleType ? `${req.moduleType} Credits` : 'Total Credits'}: {req.moduleType 
                                        ? `${calculateCreditsCompleted(completed, req.moduleType)}/${req.minCredits} ECTS`
                                        : `${calculateCreditsAttended(attended, completed)}/${req.minCredits} ECTS`
                                      }
                                    {:else if isPrerequisiteRequirement(req)}
                                      {req.requirement === "besucht" ? "Attended" : "Completed"}: {req.courses.join(", ")}
                                    {/if}
                                  </span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {:else}
                          <div class={prereqMet ? 'text-text-primary' : 'text-text-secondary'}>
                            <span class="font-medium">{prereq.requirement === "besucht" ? "Attended" : "Completed"}:</span>
                            <div class="ml-2 mt-1 space-y-1">
                              {#each prereq.courses as courseId}
                                {@const course = COURSES.find(c => c.id === courseId)}
                                {@const courseMet = prereq.requirement === "besucht" ? (attended.has(courseId) || completed.has(courseId)) : completed.has(courseId)}
                                <div class="flex items-center gap-1.5 text-xs">
                                  <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                                  <span class={courseMet ? 'text-text-primary' : 'text-text-secondary'}>
                                    {course?.label || courseId}
                                  </span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-sm text-text-secondary">None</p>
              {/if}
            </div>

            <div class="border-t border-border-primary pt-4 space-y-2">
              <button 
                onclick={() => markAttended(selection!.id)}
                disabled={isLocked || isCompleted}
                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all {isAttended 
                  ? 'bg-yellow-200 text-yellow-900 border-2 border-yellow-400 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-500 dark:hover:bg-yellow-700' 
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
              >
                {#if isAttended}
                  <div class="i-lucide-check"></div>
                  Attended
                {:else}
                  <div class="i-lucide-eye"></div>
                  Mark as Attended
                {/if}
              </button>
              
              <button 
                onclick={() => markCompleted(selection!.id)}
                disabled={isLocked}
                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all {isCompleted
                  ? 'bg-green-200 text-green-900 border-2 border-green-400 hover:bg-green-300 dark:bg-green-800 dark:text-green-100 dark:border-green-500 dark:hover:bg-green-700'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
              >
                {#if isCompleted}
                  <div class="i-lucide-check-circle"></div>
                  Completed
                {:else}
                  <div class="i-lucide-circle-check"></div>
                  Mark as Completed
                {/if}
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="p-6 space-y-6">
          <div class="text-center py-8">
            <div class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-text-secondary mb-3"></div>
            <p class="text-sm text-text-secondary">
              Click on a course to view details and track your progress
            </p>
            <p class="text-xs text-text-tertiary mt-2">
              Click on dashed "Wahl-Modul" nodes to select courses
            </p>
          </div>
          
          <div class="border-t border-border-primary pt-6">
            <h3 class="text-sm font-semibold text-text-primary mb-3">Status Legend</h3>
            <div class="space-y-2.5">
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-green-200 border-2 border-green-400 dark:bg-green-800 dark:border-green-500"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Completed</span> - Passed the course</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-yellow-200 border-2 border-yellow-400 dark:bg-yellow-800 dark:border-yellow-500"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Attended</span> - Currently taking</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-blue-200 border-2 border-blue-400 dark:bg-blue-800 dark:border-blue-500"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Available</span> - Ready to take</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300 opacity-50 dark:bg-gray-700 dark:border-gray-600"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Locked</span> - Prerequisites needed</span>
              </div>
            </div>
          </div>
          
          <div class="border-t border-border-primary pt-6">
            <h3 class="text-sm font-semibold text-text-primary mb-3">Edge Highlighting</h3>
            <div class="space-y-2.5">
              <div class="flex items-center gap-3">
                <div class="w-4 h-0.5 bg-amber-500 border-0" style="border-top: 3px dashed rgb(245 158 11);"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Prerequisites</span> - Required courses</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-0.5 bg-blue-500 border-0" style="border-top: 3px solid rgb(59 130 246);"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Dependents</span> - Courses that require this</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </aside>
  </div>
</div>

