<script lang="ts">
  import type { StudyPlan } from "$lib/data/study-plan";
  import { calculatePlanSemesterCredits } from "$lib/data/study-plan";
  import { useViewport } from "@xyflow/svelte";

  let {
    semester,
    plan,
    isPreview = false,
    length = 1500
  }: {
    semester: number;
    plan: StudyPlan;
    isPreview?: boolean;
    length?: number;
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
  const lineOpacity = $derived(isPreview ? 0.35 : 1);
  const textOpacity = $derived(isPreview ? 0.5 : 1);
  const LINE_START = -150;
  const lineEnd = $derived(LINE_START + length);
</script>

<line
  x1={LINE_START}
  y1={yPosition}
  x2={lineEnd}
  y2={yPosition}
  stroke="rgb(var(--border-primary))"
  stroke-width={strokeWidth}
  stroke-dasharray={dashArray}
  stroke-opacity={lineOpacity}
/>
<text
  x="-100"
  y={yPosition - 50}
  fill="rgb(var(--text-secondary))"
  font-size={titleFontSize}
  font-weight="500"
  opacity={textOpacity}
>
  Semester {semester}
</text>
<text
  x="-100"
  y={yPosition - 20}
  fill="rgb(var(--text-secondary))"
  font-size={titleFontSize}
  opacity={textOpacity}
>
  {semesterCredits} ECTS
</text>
