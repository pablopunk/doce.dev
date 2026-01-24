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
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					onMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>);
				}
			}}
			role="slider"
			aria-orientation="vertical"
			aria-label="Resize separator"
			aria-valuenow={50}
			aria-valuemin={0}
			aria-valuemax={100}
			tabIndex={0}
		/>
	);
}
