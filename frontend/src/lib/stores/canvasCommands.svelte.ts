export type CanvasCommands = {
	centerOnElement: (element: Element) => Promise<void>;
};

let commands: CanvasCommands | null = $state(null);

// GuidedTutorial lives outside the SvelteFlowProvider, so the canvas
// registers its imperative viewport commands here.
export const canvasCommands = {
	get current() {
		return commands;
	},
	set(next: CanvasCommands | null) {
		commands = next;
	},
};
