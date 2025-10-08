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
    ects?: number;
    prereqs: string[];
    url?: string;
    semester?: number;
  };

  const COURSES: Course[] = [
    { id: "math1", label: "Discrete Math 1", ects: 6, prereqs: [], semester: 1 },
    { id: "prog1", label: "Programming 1", ects: 6, prereqs: [], semester: 1 },
    { id: "prog2", label: "Programming 2", ects: 6, prereqs: ["prog1"], semester: 2 },
    { id: "algo", label: "Algorithms", ects: 6, prereqs: ["prog2", "math1"], semester: 3 },
    { id: "net1", label: "Networking 1", ects: 4, prereqs: [], semester: 1 },
    { id: "net2", label: "Networking 2", ects: 4, prereqs: ["net1"], semester: 2 },
    { id: "cloud", label: "Cloud Tech", ects: 4, prereqs: ["net2", "prog2"], semester: 3 },
  ];

  function computeStatuses(
    courses: Course[],
    completed: Set<string>
  ): Record<string, Status> {
    const s: Record<string, Status> = {};
    for (const c of courses)
      s[c.id] = completed.has(c.id)
        ? "completed"
        : c.prereqs.every((p) => completed.has(p))
          ? "available"
          : "locked";
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
      nodesep: 24,
      ranksep: 40,
      marginx: 16,
      marginy: 16,
    });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: 180, height: 64 }));
    edges.forEach((e) => g.setEdge(e.source as string, e.target as string));

    dagre.layout(g);
    nodes = nodes.map((n) => {
      const p = g.node(n.id);
      return { ...n, position: { x: p.x, y: p.y } };
    });
  }

  function applyStatuses() {
    statuses = computeStatuses(COURSES, completed);
    nodes = nodes.map((n) => {
      const s = statuses[n.id];
      const styleStr =
        s === "completed"
          ? "border-color: #86efac; background: #f0fdf4; border-radius: 16px; padding: 12px; border-width: 2px;"
          : s === "available"
            ? "border-color: #93c5fd; background: #eff6ff; border-radius: 16px; padding: 12px; border-width: 2px;"
            : "border-color: #e2e8f0; background: #f8fafc; border-radius: 16px; padding: 12px; border-width: 2px;";
      return { ...n, style: styleStr };
    });
    edges = edges.map((e) => ({
      ...e,
      animated: statuses[e.target as string] === "available",
    }));
  }

  function toggleComplete(id: string) {
    if (completed.has(id)) completed.delete(id);
    else completed.add(id);
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
    const saved = localStorage.getItem("completedCourses");
    if (saved) {
      completed = new Set<string>(JSON.parse(saved));
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
    <SvelteFlow {nodes} {edges} onnodeclick={handleNodeClick} onmove={handleMove} nodesDraggable={false} fitView>
      <svg 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;"
        class="semester-dividers"
      >
        <g transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})">
          <!-- Semester 1 divider -->
          <line x1="-200" y1="120" x2="1000" y2="120" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="110" fill="#64748b" font-size="{13 / viewport.zoom}" font-weight="500">Semester 1</text>
          
          <!-- Semester 2 divider -->
          <line x1="-200" y1="350" x2="1000" y2="350" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="340" fill="#64748b" font-size="{13 / viewport.zoom}" font-weight="500">Semester 2</text>
          
          <!-- Semester 3 divider -->
          <line x1="-200" y1="550" x2="1000" y2="550" stroke="#cbd5e1" stroke-width="{1 / viewport.zoom}" stroke-dasharray="{8 / viewport.zoom},{4 / viewport.zoom}" />
          <text x="-150" y="540" fill="#64748b" font-size="{13 / viewport.zoom}" font-weight="500">Semester 3</text>
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
        ECTS: {selection.ects ?? 0} • Semester: {selection.semester ?? "—"}
      </p>
      <p style="font-size: 0.9rem;">
        Prereqs: {selection.prereqs.length ? selection.prereqs.join(", ") : "—"}
      </p>
      <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn" onclick={() => toggleComplete(selection!.id)}
          >Toggle completed</button
        >
        <span style="font-size: 0.75rem; color:#64748b; align-self: center;"
          >progress saved in localStorage</span
        >
      </div>
    {:else}
      <p style="color:#64748b; font-size:0.9rem;">
        Select a course to see details. Toggle completion to unlock dependents;
        available edges will animate.
      </p>
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
