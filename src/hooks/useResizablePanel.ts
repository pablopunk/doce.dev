import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

interface UseResizablePanelOptions {
	projectId: string;
	minSize?: number; // percentage (default 25)
	maxSize?: number; // percentage (default 75)
	defaultSize?: number; // percentage (default 50)
	containerRef?: RefObject<HTMLDivElement | null>; // Optional: pass the container ref for accurate positioning
}

interface UseResizablePanelReturn {
	leftPercent: number;
	rightPercent: number;
	isDragging: boolean;
	onSeparatorMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
	containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Custom hook for managing resizable panel layout
 * Handles drag-to-resize with localStorage persistence
 */
export function useResizablePanel({
	projectId,
	minSize = 25,
	maxSize = 75,
	defaultSize = 50,
	containerRef: externalRef,
}: UseResizablePanelOptions): UseResizablePanelReturn {
	const internalRef = useRef<HTMLDivElement>(null);
	const containerRef = externalRef || internalRef;

	const [leftPercent, setLeftPercent] = useState(defaultSize);
	const [isDragging, setIsDragging] = useState(false);

	// Load from localStorage on mount
	useEffect(() => {
		if (typeof window === "undefined") return;

		const storageKey = `resizable-panel-${projectId}`;
		const saved = localStorage.getItem(storageKey);

		if (saved) {
			try {
				const parsed = parseFloat(saved);
				if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
					setLeftPercent(parsed);
				}
			} catch {
				// Invalid storage, ignore
			}
		}
	}, [projectId, minSize, maxSize]);

	// Handle mouse move during drag
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			const newLeftPercent = ((e.clientX - rect.left) / rect.width) * 100;

			// Constrain to min/max
			const constrained = Math.max(minSize, Math.min(maxSize, newLeftPercent));

			setLeftPercent(constrained);
		},
		[minSize, maxSize, containerRef],
	);

	// Handle mouse up (end drag)
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Attach/detach global mouse listeners
	useEffect(() => {
		if (!isDragging) return;

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, handleMouseMove, handleMouseUp]);

	// Save to localStorage whenever layout changes
	useEffect(() => {
		if (typeof window === "undefined") return;

		const storageKey = `resizable-panel-${projectId}`;
		localStorage.setItem(storageKey, leftPercent.toFixed(3));
	}, [leftPercent, projectId]);

	// Handle separator mouse down (start drag)
	const onSeparatorMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault();
			setIsDragging(true);
		},
		[],
	);

	return {
		leftPercent,
		rightPercent: 100 - leftPercent,
		isDragging,
		onSeparatorMouseDown,
		containerRef,
	};
}
