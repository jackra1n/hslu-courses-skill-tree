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
      style:
        "border-radius: 16px; padding: 12px; border-width: 2px; background: white; white-space: pre-line; text-align: center;",
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
      let styleStr = "";
      
      if (s === "completed") {
        styleStr = "border-color: #86efac; background: #f0fdf4; border-radius: 16px; padding: 12px; border-width: 2px;";
      } else if (isAttended) {
        styleStr = "border-color: #fbbf24; background: #fffbeb; border-radius: 16px; padding: 12px; border-width: 2px;";
      } else if (s === "available") {
        styleStr = "border-color: #93c5fd; background: #eff6ff; border-radius: 16px; padding: 12px; border-width: 2px;";
      } else {
        styleStr = "border-color: #e5e7eb; background: #f9fafb; border-radius: 16px; padding: 12px; border-width: 2px; opacity: 0.5;";
      }
      return { ...n, style: styleStr };
    });
    edges = edges.map((e) => ({
      ...e,
      animated: statuses[e.target as string] === "available",
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

<div
  style="display: grid; grid-template-columns: 1fr 320px; height: 80vh; gap: 0;"
>
  <div style="position: relative;">
    <SvelteFlow {nodes} {edges} onnodeclick={handleNodeClick} onmove={handleMove} nodesDraggable={false} nodesConnectable={false} fitView>
      <svg 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;"
        class="semester-dividers"
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

  <aside class="sidebar">
    {#if selection}
      <h2 style="font-weight: 700; font-size: 1.125rem;">{selection.label}</h2>
      <p style="color:#64748b; font-size: 0.9rem;">
        ECTS: {selection.ects} • Semester: {selection.semester}
        {#if selection.type}
          <br/><span style="color:#7c3aed;">📚 {selection.type}</span>
        {/if}
      </p>
      <p style="font-size: 0.9rem;">
        Prerequisites (attended): {selection.prereqs.length ? selection.prereqs.map(id => COURSES.find(c => c.id === id)?.label || id).join(", ") : "None"}
      </p>
      {#if selection}
        {@const isLocked = statuses[selection.id] === "locked"}
        {@const isAttended = attended.has(selection.id)}
        {@const isCompleted = completed.has(selection.id)}
        <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
          <button 
            class="btn" 
            onclick={() => markAttended(selection!.id)}
            disabled={isLocked || isCompleted}
            style="background: {isAttended ? '#fef3c7' : 'white'}; {isLocked || isCompleted ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
          >
            {isAttended ? '✓ Attended' : 'Mark Attended'}
          </button>
          <button 
            class="btn" 
            onclick={() => markCompleted(selection!.id)}
            disabled={isLocked}
            style="background: {isCompleted ? '#dcfce7' : 'white'}; {isLocked ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
          >
            {isCompleted ? '✓ Completed' : 'Mark Completed'}
          </button>
        </div>
      {/if}
    {:else}
      <p style="color:#64748b; font-size:0.9rem;">
        Select a course to see details. Mark courses as attended or completed to unlock dependent courses.
      </p>
      <div style="margin-top: 1rem; font-size: 0.85rem; color: #64748b;">
        <p><strong>Status colors:</strong></p>
        <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
          <li>🟢 <strong>Green</strong>: Completed</li>
          <li>🟡 <strong>Yellow</strong>: Attended</li>
          <li>🔵 <strong>Blue</strong>: Available</li>
          <li>⚪ <strong>Gray</strong>: Locked (prerequisites not met)</li>
        </ul>
      </div>
    {/if}
  </aside>
</div>

<style>
  .sidebar {
    border-left: 1px solid #e2e8f0;
    padding: 1rem;
  }
  .btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    cursor: pointer;
  }
</style>
