<script lang="ts">
  import type { StudyPlan } from "$lib/data/study-plan";
  import { calculatePlanSemesterCredits } from "$lib/data/study-plan";
  import { useViewport } from "@xyflow/svelte";

  let {
    semester,
    plan
  }: {
    semester: number;
    plan: StudyPlan;
  } = $props();

  const viewportSignal = useViewport();
  const viewport = $derived(viewportSignal.current);

  const BASE_OFFSET = 150;
  const SEMESTER_SPACING = 200;

  const minStrokeWidth = $derived(2);
  const strokeWidth = $derived(Math.max(minStrokeWidth, 1 / viewport.zoom));
  const dashArray = $derived(`${8 / viewport.zoom},${4 / viewport.zoom}`);
  const titleFontSize = $derived(Math.max(21, 12 / viewport.zoom));
  const yPosition = $derived(BASE_OFFSET + SEMESTER_SPACING * semester);
  const semesterCredits = $derived(calculatePlanSemesterCredits(plan, semester));
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
  y={yPosition - 50}
  fill="rgb(var(--text-secondary))"
  font-size={titleFontSize}
  font-weight="500"
>
  Semester {semester}
</text>
<text
  x="-100"
  y={yPosition - 20}
  fill="rgb(var(--text-secondary))"
  font-size={titleFontSize}
>
  {semesterCredits} ECTS
</text>
