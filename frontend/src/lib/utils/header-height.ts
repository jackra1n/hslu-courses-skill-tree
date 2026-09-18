export function measureHeaderHeight(header: HTMLElement): () => void {
	const root = header.ownerDocument.documentElement;
	const updateHeight = () => {
		root.style.setProperty(
			'--app-header-height',
			`${header.getBoundingClientRect().height}px`,
		);
	};
	const observer = new ResizeObserver(updateHeight);
	observer.observe(header, { box: 'border-box' });
	updateHeight();

	return () => {
		observer.disconnect();
		root.style.removeProperty('--app-header-height');
	};
}
