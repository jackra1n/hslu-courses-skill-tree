<script lang="ts">
import * as m from '$lib/paraglide/messages';
</script>

<div class="border-t border-border-primary pt-6">
  <h3 class="text-sm font-semibold text-text-primary mb-3">{m.legend_title()}</h3>
  <div class="space-y-2.5 mb-6">
    <div class="flex items-center gap-3">
      <div class="w-4 h-4 rounded-full bg-green-200 border-2 border-green-400 dark:bg-green-800 dark:border-green-500"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.course_completed()}</span> - {m.legend_completed_desc()}</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="w-4 h-4 rounded-full bg-yellow-200 border-2 border-yellow-400 dark:bg-yellow-800 dark:border-yellow-500"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.course_attended()}</span> - {m.legend_attended_desc()}</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="w-4 h-4 rounded-full bg-blue-200 border-2 border-blue-400 dark:bg-blue-800 dark:border-blue-500"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.legend_available()}</span> - {m.legend_available_desc()}</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300 opacity-50 dark:bg-gray-700 dark:border-gray-600"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.legend_locked()}</span> - {m.legend_locked_desc()}</span>
    </div>
  </div>
</div>

<div class="border-t border-border-primary pt-6">
  <h3 class="text-sm font-semibold text-text-primary mb-3">{m.legend_edges()}</h3>
  <div class="space-y-2.5">
    <div class="flex items-center gap-3">
      <div class="w-4 h-0.5 bg-amber-500 border-0" style="border-top: 3px dashed rgb(245 158 11);"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.legend_prereq()}</span> - {m.legend_prereq_desc()}</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="w-4 h-0.5 bg-blue-500 border-0" style="border-top: 3px solid rgb(59 130 246);"></div>
      <span class="text-sm text-text-primary"><span class="font-medium">{m.legend_dependents()}</span> - {m.legend_dependents_desc()}</span>
    </div>
  </div>
</div>
