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
  import { COURSES, type Course, type Status, type PrerequisiteRequirement } from '$lib/data/courses';
  import { theme } from '$lib/stores/theme';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

  function evaluatePrerequisite(
    prereq: string | PrerequisiteRequirement,
    attended: Set<string>,
    completed: Set<string>
  ): boolean {
    if (typeof prereq === 'string') {
      if (prereq === "assessmentstufe bestanden") {
        return completed.size >= 6; // approximate threshold
      }
      return attended.has(prereq) || completed.has(prereq);
    }

    // handle complex prerequisites with OR logic
    const { courses, requirement } = prereq;
    
    // at least one course in the list must meet the requirement
    return courses.some(courseId => {
      if (requirement === "besucht") {
        return attended.has(courseId) || completed.has(courseId);
      } else if (requirement === "bestanden") {
        return completed.has(courseId);
      }
      return false;
    });
  }

  function computeStatuses(
    courses: Course[],
    attended: Set<string>,
    completed: Set<string>
  ): Record<string, Status> {
    const s: Record<string, Status> = {};
    for (const c of courses) {
      if (completed.has(c.id)) {
        s[c.id] = "completed";
      } else if (c.prereqs.every((p) => evaluatePrerequisite(p, attended, completed))) {
        s[c.id] = "available";
      } else {
        s[c.id] = "locked";
      }
    }
    return s;
  }

  function getNodeLabel(course: Course): string {
    if (showShortNamesOnly) {
      return course.id;
    }
    return `${course.label} (${course.id})`;
  }

  function toGraph(courses: Course[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = courses.map((c) => ({
      id: c.id,
      position: { x: 0, y: 0 },
      data: { 
        label: getNodeLabel(c)
      },
      style: "",
    }));
    
    const edges: Edge[] = courses.flatMap((c) => {
      return c.prereqs.flatMap((p) => {
        if (typeof p === 'string') {
          if (p === "assessmentstufe bestanden") {
            return [];
          }
          return [{
            id: `${p}=>${c.id}`,
            source: p,
            target: c.id,
            sourcePosition: Position.Top,
            targetPosition: Position.Bottom,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: false,
            style: "stroke-width: 2px;",
            type: "smoothstep",
          }];
        } else {
          // complex prerequisite, create edges for all courses in the group
          return p.courses.map((courseId) => ({
            id: `${courseId}=>${c.id}`,
            source: courseId,
            target: c.id,
            sourcePosition: Position.Top,
            targetPosition: Position.Bottom,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: false,
            style: "stroke-width: 2px;",
            type: "smoothstep",
          }));
        }
      });
    });
    
    return { nodes, edges };
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let selection: Course | null = null;
  let attended = new Set<string>();
  let completed = new Set<string>();
  let statuses: Record<string, Status> = {};
  let showAssessmentInfo = false;
  let showShortNamesOnly = false;
  let useELKLayout = false;
  
  let viewport = { x: 0, y: 0, zoom: 1 };
  
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
        "elk.spacing.nodeNode": "60",
        "elk.spacing.edgeNode": "20",
        "elk.layered.spacing.nodeNodeBetweenLayers": "150",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.edgeEdge": "20"
      },
      children: nodes.map(node => {
        const course = COURSES.find(c => c.id === node.id);
        return {
          id: node.id,
          width: 180,
          height: 64,
          layoutOptions: {
            "elk.priority": String(course?.semester || 1)
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
      
      // extract positions from ELK layout
      const nodePositions: Record<string, { x: number; y: number }> = {};
      
      layoutedGraph.children?.forEach(node => {
        nodePositions[node.id] = {
          x: (node as any).x || 0,
          y: (node as any).y || 0
        };
      });

      // update node positions
      nodes = nodes.map((n) => {
        const position = nodePositions[n.id] || { x: 0, y: 0 };
        return { ...n, position };
      });
    } catch (error) {
      console.error("ELK layout failed:", error);
      // fallback to simple semester-based positioning
      layoutSemesterBased();
    }
  }

  function layoutSemesterBased() {
    // group courses by semester
    const semesterGroups: Record<number, Course[]> = {};
    COURSES.forEach(course => {
      if (!semesterGroups[course.semester]) {
        semesterGroups[course.semester] = [];
      }
      semesterGroups[course.semester].push(course);
    });

    // position nodes in vertical columns within each semester
    nodes = nodes.map((n) => {
      const course = COURSES.find((c) => c.id === n.id);
      if (!course) return n;

      const semesterCourses = semesterGroups[course.semester];
      const courseIndex = semesterCourses.findIndex(c => c.id === n.id);
      
      // calculate position: semester determines Y, course index determines X
      const semesterY = (course.semester - 1) * 200 + 100;
      const courseX = courseIndex * 220 + 100; // 220px spacing between courses
      
      return { ...n, position: { x: courseX, y: semesterY } };
    });
  }

  function updateNodeLabels() {
    nodes = nodes.map((n) => {
      const course = COURSES.find((c) => c.id === n.id);
      return { ...n, data: { label: course ? getNodeLabel(course) : n.data.label } };
    });
  }

  function applyStatuses() {
    statuses = computeStatuses(COURSES, attended, completed);
    nodes = nodes.map((n) => {
      const s = statuses[n.id];
      const isAttended = attended.has(n.id);
      const isSelected = selection?.id === n.id;
      let styleStr = "padding: 14px; border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: 180px; font-family: Inter, sans-serif; transition: all 0.2s; ";

      if (isSelected) {
        styleStr += "border-width: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0,0,0,0.1); transform: scale(1.05); ";
      } else {
        styleStr += "border-width: 2px; ";
      }
      
      if (s === "completed") {
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
    
    // apply edge highlighting based on selection
    edges = edges.map((e) => {
      const isSelected = selection?.id === e.source || selection?.id === e.target;
      const isPrerequisite = selection?.id === e.target;
      const isDependent = selection?.id === e.source;
      
      let edgeStyle = "stroke-width: 2px; transition: all 0.2s; ";
      let markerEnd = e.markerEnd;
      
      if (isSelected) {
        if (isPrerequisite) {
          // highlight prerequisite edges (incoming) in orange/amber
          edgeStyle += "stroke: #f59e0b; stroke-width: 3px; stroke-dasharray: 5,5; ";
          markerEnd = { type: MarkerType.ArrowClosed, color: "#f59e0b" };
        } else if (isDependent) {
          // highlight dependent edges (outgoing) in light blue
          edgeStyle += "stroke: #3b82f6; stroke-width: 3px; ";
          markerEnd = { type: MarkerType.ArrowClosed, color: "#3b82f6" };
        }
      } else {
        // default edge styling
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
    
    // force reactivity update for sidebar
    if (selection) {
      selection = { ...selection };
    }
  }
  
  function markAttended(id: string) {
    const course = COURSES.find((c) => c.id === id);
    if (!course) return;
    
    const prereqsMet = course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed));
    if (!prereqsMet) return;
    
    if (attended.has(id)) {
      attended.delete(id);
    } else {
      attended.add(id);
    }
    localStorage.setItem("attendedCourses", JSON.stringify([...attended]));
    applyStatuses();
  }
  
  function markCompleted(id: string) {
    const course = COURSES.find((c) => c.id === id);
    if (!course) return;

    const prereqsMet = course.prereqs.every((p) => evaluatePrerequisite(p, attended, completed));
    if (!prereqsMet) return;
    
    if (completed.has(id)) {
      completed.delete(id);
    } else {
      completed.add(id);
      // if completed, remove from attended
      attended.delete(id);
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
    const course = COURSES.find((c) => c.id === node.id) || null;
    selection = course;
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

    const g = toGraph(COURSES);
    nodes = g.nodes;
    edges = g.edges;
    console.log("Initial nodes:", nodes.length);
    console.log("Initial edges:", edges.length);
    
    // use semester-based layout for now to ensure it works
    if (useELKLayout) {
      await layoutELK();
    } else {
      layoutSemesterBased();
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
    <div class="flex items-center gap-3">
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
            layoutSemesterBased();
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
      <ThemeSwitcher />
    </div>
  </header>
  
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
      <SvelteFlow {nodes} {edges} onnodeclick={handleNodeClick} onmove={handleMove} nodesDraggable={false} nodesConnectable={false} fitView colorMode={$theme === 'system' ? 'system' : $theme}>
      <svg 
        class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <g transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})">
          <!-- Semester 1 divider -->
          <line x1="-100" y1="250" x2="2000" y2="250" stroke="rgb(var(--border-primary))" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-50" y="240" fill="rgb(var(--text-secondary))" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 1</text>
          
          <!-- Semester 2 divider -->
          <line x1="-100" y1="450" x2="2000" y2="450" stroke="rgb(var(--border-primary))" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-50" y="440" fill="rgb(var(--text-secondary))" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 2</text>
          
          <!-- Semester 3 divider -->
          <line x1="-100" y1="650" x2="2000" y2="650" stroke="rgb(var(--border-primary))" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-50" y="640" fill="rgb(var(--text-secondary))" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 3</text>
        </g>
      </svg>
        <MiniMap />
        <Controls />
        <Background gap={16} />
      </SvelteFlow>
    </div>

    <aside class="border-l border-border-primary bg-bg-secondary overflow-y-auto">
      {#if selection}
        {@const isLocked = statuses[selection.id] === "locked"}
        {@const isAttended = attended.has(selection.id)}
        {@const isCompleted = completed.has(selection.id)}
        
        <div class="p-6 space-y-6">
          <div>
            <h2 class="text-xl font-bold text-text-primary mb-3">{selection.label}</h2>
            
            <div class="flex items-center gap-4 text-sm text-text-secondary mb-2">
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-book-open text-text-secondary"></div>
                <span>{selection.ects} ECTS</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-calendar text-text-secondary"></div>
                <span>Semester {selection.semester}</span>
              </div>
            </div>
            
            {#if selection.type}
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-md text-sm font-medium">
                <div class="i-lucide-layers text-purple-600"></div>
                {selection.type}
              </div>
            {/if}
          </div>

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
        </div>
      {:else}
        <div class="p-6 space-y-6">
          <div class="text-center py-8">
            <div class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-text-secondary mb-3"></div>
            <p class="text-sm text-text-secondary">
              Click on a course to view details and track your progress
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
                <div class="w-4 h-0.5 bg-amber-500 border-0" style="border-top: 3px dashed #f59e0b;"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Prerequisites</span> - Required courses</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-0.5 bg-blue-500 border-0" style="border-top: 3px solid #3b82f6;"></div>
                <span class="text-sm text-text-primary"><span class="font-medium">Dependents</span> - Courses that require this</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </aside>
  </div>
</div>

