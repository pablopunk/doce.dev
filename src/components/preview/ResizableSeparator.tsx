interface ResizableSeparatorProps {
	onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * A draggable separator component for resizing panels
 * Provides visual feedback via cursor and background color on hover/drag
 */
export function ResizableSeparator({ onMouseDown }: ResizableSeparatorProps) {
	return (
		<div
			className="h-full w-1 bg-border transition-colors duration-150 hover:bg-accent cursor-col-resize active:bg-accent flex-shrink-0"
			onMouseDown={onMouseDown}
			role="separator"
			aria-orientation="vertical"
			tabIndex={0}
		/>
	);
}
