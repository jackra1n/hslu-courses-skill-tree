<script lang="ts">
  import type { CurriculumTemplate } from '$lib/data/courses';
  import { calculateSemesterCredits } from '$lib/data/courses';
  import { getSlotSemesterOverrides } from '$lib/stores/courseStore.svelte';

  let { 
    semester,
    viewport,
    currentTemplate,
    userSelections
  }: {
    semester: number;
    viewport: { x: number; y: number; zoom: number };
    currentTemplate: CurriculumTemplate;
    userSelections: Record<string, string>;
  } = $props();

  const BASE_OFFSET = 150;
  const SEMESTER_SPACING = 200;

  const slotSemesterOverrides = $derived(getSlotSemesterOverrides());
  const minStrokeWidth = $derived(2);
  const strokeWidth = $derived(Math.max(minStrokeWidth, 1 / viewport.zoom));
  const dashArray = $derived(`${8 / viewport.zoom},${4 / viewport.zoom}`);
  const titleFontSize = $derived(Math.max(15, 12 / viewport.zoom));
  const creditsFontSize = $derived(Math.max(15, 10 / viewport.zoom));
  const yPosition = $derived(BASE_OFFSET + SEMESTER_SPACING * semester);
  const semesterCredits = $derived(
    calculateSemesterCredits(semester, currentTemplate, userSelections, slotSemesterOverrides)
  );
</script>

<line 
  x1="-150" 
  y1={yPosition} 
  x2="2000" 
  y2={yPosition} 
  stroke="rgb(var(--border-primary))" 
  stroke-width={strokeWidth} 
  stroke-dasharray={dashArray} 
/>
<text 
  x="-100" 
  y={yPosition - 10} 
  fill="rgb(var(--text-secondary))" 
  font-size={titleFontSize} 
  font-weight="500"
>
  Semester {semester}
</text>
<text 
  x="-100" 
  y={yPosition + 20}
  fill="rgb(var(--text-secondary))" 
  font-size={creditsFontSize}
>
  {semesterCredits} ECTS
</text>
