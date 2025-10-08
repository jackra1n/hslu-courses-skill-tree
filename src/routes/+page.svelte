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
  import dagre from "@dagrejs/dagre";

  type Status = "locked" | "available" | "completed";
  type Course = {
    id: string;
    label: string;
    ects: number;
    prereqs: string[]; // "attended" requirements
    prereqsPassed?: string[]; // "passed" requirements
    url?: string;
    semester: number;
    type?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul";
  };

  const COURSES: Course[] = [
    // Semester 1
    { id: "ana-g", label: "Grundlagen der Analysis", ects: 3, prereqs: [], semester: 1 },
    { id: "dmath-algo", label: "Diskrete Mathematik Datenstrukturen und Algorithmen", ects: 3, prereqs: [], semester: 1 },
    { id: "oop", label: "Objektorientierte Programmierung", ects: 6, prereqs: [], semester: 1 },
    { id: "cna", label: "Computer & Network Architecture", ects: 6, prereqs: [], semester: 1 },
    { id: "lial", label: "Lineare Algebra", ects: 3, prereqs: [], semester: 1 },
    { id: "pta", label: "Projekt- und Teamarbeit", ects: 6, prereqs: [], semester: 1, type: "Projektmodul" },
    
    // Semester 2
    { id: "ana-f", label: "Fortgeschrittene Analysis", ects: 3, prereqs: ["ana-g"], semester: 2 },
    { id: "dmath-code", label: "Diskrete Mathematik Datenverschlüsselung und Datenkodierung", ects: 3, prereqs: ["dmath-algo"], semester: 2 },
    { id: "ad", label: "Algorithmen & Datenstrukturen", ects: 6, prereqs: ["oop"], semester: 2 },
    { id: "iteo", label: "IT-System Engineering & Operation", ects: 6, prereqs: [], semester: 2 },
    { id: "mod", label: "Modellierung Grundlagen", ects: 3, prereqs: [], semester: 2 },
    { id: "pmb", label: "Project Management Basics", ects: 3, prereqs: ["pta"], semester: 2 },
  ];

  function computeStatuses(
    courses: Course[],
    attended: Set<string>,
    completed: Set<string>
  ): Record<string, Status> {
    const s: Record<string, Status> = {};
    for (const c of courses) {
      if (completed.has(c.id)) {
        s[c.id] = "completed";
      } else if (c.prereqs.every((p) => attended.has(p) || completed.has(p))) {
        s[c.id] = "available";
      } else {
        s[c.id] = "locked";
      }
    }
    return s;
  }

  function toGraph(courses: Course[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = courses.map((c) => ({
      id: c.id,
      position: { x: 0, y: 0 },
      data: { 
        label: c.label
      },
      style: "",
    }));
    const edges: Edge[] = courses.flatMap((c) =>
      c.prereqs.map((p) => ({
        id: `${p}=>${c.id}`,
        source: p,
        target: c.id,
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: false,
        style: "stroke-width: 2px;",
        type: "smoothstep",
      }))
    );
    return { nodes, edges };
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let selection: Course | null = null;
  let attended = new Set<string>();
  let completed = new Set<string>();
  let statuses: Record<string, Status> = {};
  
  let viewport = { x: 0, y: 0, zoom: 1 };
  
  const handleMove: OnMove = (event, viewportData) => {
    viewport = viewportData;
  };

  function layoutDagre() {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "TB",
      nodesep: 50,
      ranksep: 200,
      marginx: 16,
      marginy: 16,
    });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: 180, height: 64 }));
    edges.forEach((e) => g.setEdge(e.source as string, e.target as string));

    dagre.layout(g);
    
    // position nodes based on semester and dagre's x-position
    nodes = nodes.map((n) => {
      const p = g.node(n.id);
      const course = COURSES.find((c) => c.id === n.id);
      const semesterY = course?.semester ? (course.semester - 1) * 200 + 100 : p.y;
      return { ...n, position: { x: p.x, y: semesterY } };
    });
  }

  function applyStatuses() {
    statuses = computeStatuses(COURSES, attended, completed);
    nodes = nodes.map((n) => {
      const s = statuses[n.id];
      const isAttended = attended.has(n.id);
      let styleStr = "padding: 14px; border-radius: 12px; border-width: 2px; font-weight: 500; font-size: 14px; text-align: center; min-width: 180px; font-family: Inter, sans-serif; ";
      
      if (s === "completed") {
        styleStr += "background: #f0fdf4; border-color: #4ade80; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (isAttended) {
        styleStr += "background: #fef3c7; border-color: #fbbf24; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (s === "available") {
        styleStr += "background: #eff6ff; border-color: #60a5fa; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else {
        styleStr += "background: #f9fafb; border-color: #d1d5db; color: #9ca3af; opacity: 0.6;";
      }
      return { ...n, style: styleStr };
    });
    edges = edges.map((e) => ({
      ...e,
      animated: statuses[e.target as string] === "available",
      style: "stroke-width: 2px; stroke: #cbd5e0;",
    }));
  }
  
  function markAttended(id: string) {
    const course = COURSES.find((c) => c.id === id);
    if (!course) return;
    
    // Check if prerequisites are met
    const prereqsMet = course.prereqs.every((p) => attended.has(p) || completed.has(p));
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

    const prereqsMet = course.prereqs.every((p) => attended.has(p) || completed.has(p));
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
  }

  onMount(() => {
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
    layoutDagre();
    applyStatuses();
  });
</script>

<div class="font-sans h-screen flex flex-col">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-2xl font-bold text-gray-900">HSLU Course Skill Tree</h1>
    <p class="text-sm text-gray-600 mt-1">Track your progress through course prerequisites</p>
  </header>
  
  <div class="flex-1 grid grid-cols-[1fr_400px] min-h-0">
    <div class="relative">
      <SvelteFlow {nodes} {edges} onnodeclick={handleNodeClick} onmove={handleMove} nodesDraggable={false} nodesConnectable={false} fitView>
      <svg 
        class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <g transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})">
          <!-- Semester 1 divider -->
          <line x1="-200" y1="200" x2="2000" y2="200" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="190" fill="#64748b" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 1</text>
          
          <!-- Semester 2 divider -->
          <line x1="-200" y1="400" x2="2000" y2="400" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="390" fill="#64748b" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 2</text>
          
          <!-- Semester 3 divider -->
          <line x1="-200" y1="600" x2="2000" y2="600" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="590" fill="#64748b" font-size="{Math.max(15, 15 / viewport.zoom)}" font-weight="500">Semester 3</text>
        </g>
      </svg>
        <MiniMap />
        <Controls />
        <Background gap={16} />
      </SvelteFlow>
    </div>

    <aside class="border-l border-gray-200 bg-gray-50 overflow-y-auto">
      {#if selection}
        {@const isLocked = statuses[selection.id] === "locked"}
        {@const isAttended = attended.has(selection.id)}
        {@const isCompleted = completed.has(selection.id)}
        
        <div class="p-6 space-y-6">
          <div>
            <h2 class="text-xl font-bold text-gray-900 mb-3">{selection.label}</h2>
            
            <div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-book-open text-gray-500"></div>
                <span>{selection.ects} ECTS</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="i-lucide-calendar text-gray-500"></div>
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

          <div class="border-t border-gray-200 pt-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <div class="i-lucide-git-branch text-gray-500"></div>
              Prerequisites
            </h3>
            {#if selection.prereqs.length > 0}
              <ul class="space-y-1.5">
                {#each selection.prereqs as prereqId}
                  {@const prereqCourse = COURSES.find(c => c.id === prereqId)}
                  {@const prereqMet = attended.has(prereqId) || completed.has(prereqId)}
                  <li class="flex items-start gap-2 text-sm">
                    <div class="{prereqMet ? 'i-lucide-check-circle text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
                    <span class={prereqMet ? 'text-gray-900' : 'text-gray-500'}>
                      {prereqCourse?.label || prereqId}
                    </span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-sm text-gray-500">None</p>
            {/if}
          </div>

          <div class="border-t border-gray-200 pt-4 space-y-2">
            <button 
              onclick={() => markAttended(selection!.id)}
              disabled={isLocked || isCompleted}
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all {isAttended 
                ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 hover:bg-amber-200' 
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
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
                ? 'bg-green-100 text-green-900 border-2 border-green-300 hover:bg-green-200'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
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
            <div class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-gray-400 mb-3"></div>
            <p class="text-sm text-gray-600">
              Click on a course to view details and track your progress
            </p>
          </div>
          
          <div class="border-t border-gray-200 pt-6">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">Status Legend</h3>
            <div class="space-y-2.5">
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-green-200 border-2 border-green-400"></div>
                <span class="text-sm text-gray-700"><span class="font-medium">Completed</span> - Passed the course</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-amber-200 border-2 border-amber-400"></div>
                <span class="text-sm text-gray-700"><span class="font-medium">Attended</span> - Currently taking</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-blue-200 border-2 border-blue-400"></div>
                <span class="text-sm text-gray-700"><span class="font-medium">Available</span> - Ready to take</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300 opacity-50"></div>
                <span class="text-sm text-gray-700"><span class="font-medium">Locked</span> - Prerequisites needed</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </aside>
  </div>
</div>

