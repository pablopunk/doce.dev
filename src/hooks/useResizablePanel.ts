import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useIsMobile } from "./use-mobile";

interface UseResizablePanelOptions {
	projectId: string;
	minSize?: number; // percentage (default 25)
	maxSize?: number; // percentage (default 75)
	defaultSize?: number; // percentage (default 50)
	containerRef?: RefObject<HTMLDivElement | null>; // Optional: pass the container ref for accurate positioning
	disabled?: boolean; // Explicitly disable resizing (e.g., on mobile)
}

interface UseResizablePanelReturn {
	leftPercent: number;
	rightPercent: number;
	isDragging: boolean;
	isMobile: boolean;
	isResizable: boolean;
	onSeparatorMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
	containerRef: RefObject<HTMLDivElement | null>;
}

export function useResizablePanel({
	projectId,
	minSize = 25,
	maxSize = 75,
	defaultSize = 50,
	containerRef: externalRef,
	disabled,
}: UseResizablePanelOptions): UseResizablePanelReturn {
	const internalRef = useRef<HTMLDivElement>(null);
	const containerRef = externalRef || internalRef;
	const isMobile = useIsMobile();

	const [leftPercent, setLeftPercent] = useState(defaultSize);
	const [isDragging, setIsDragging] = useState(false);

	const isResizable = !disabled && !isMobile;

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (isMobile || disabled) return;

		const storageKey = `resizable-panel-${projectId}`;
		const saved = localStorage.getItem(storageKey);

		if (saved) {
			try {
				const parsed = parseFloat(saved);
				if (!Number.isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
					setLeftPercent(parsed);
				}
			} catch {
				// Invalid storage, ignore
			}
		}
	}, [projectId, minSize, maxSize, isMobile, disabled]);

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
		(e: React.MouseEvent<HTMLElement>) => {
			e.preventDefault();
			setIsDragging(true);
		},
		[],
	);

	return {
		leftPercent,
		rightPercent: 100 - leftPercent,
		isDragging,
		isMobile,
		isResizable,
		onSeparatorMouseDown,
		containerRef,
	};
}
