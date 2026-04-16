import { GripVertical, Minimize2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatLayout } from "@/stores/useChatLayout";
import { ChatPanel } from "./ChatPanel";

interface FloatingChatPanelProps {
	projectId: string;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>;
	onOpenFile?: (filePath: string) => void;
	onStreamingStateChange?: (
		userMessageCount: number,
		isStreaming: boolean,
	) => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const SNAP_MARGIN = 16;

export function FloatingChatPanel({
	projectId,
	models = [],
	onOpenFile,
	onStreamingStateChange,
}: FloatingChatPanelProps) {
	const { isDetached, position, size, setPosition, setSize, setDetached } =
		useChatLayout();

	const panelRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isResizing, setIsResizing] = useState(false);
	const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panelX: 0, panelY: 0 });
	const resizeStartRef = useRef({
		mouseX: 0,
		mouseY: 0,
		width: 0,
		height: 0,
	});

	const clampPosition = useCallback(
		(x: number, y: number, w: number, h: number) => {
			const maxX = window.innerWidth - w - SNAP_MARGIN;
			const maxY = window.innerHeight - h - SNAP_MARGIN;
			return {
				x: Math.max(SNAP_MARGIN, Math.min(maxX, x)),
				y: Math.max(SNAP_MARGIN, Math.min(maxY, y)),
			};
		},
		[],
	);

	// Drag handlers
	const handleDragStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			setIsDragging(true);
			dragStartRef.current = {
				mouseX: e.clientX,
				mouseY: e.clientY,
				panelX: position.x,
				panelY: position.y,
			};
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
		},
		[position],
	);

	const handleDragMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isDragging) return;
			const dx = e.clientX - dragStartRef.current.mouseX;
			const dy = e.clientY - dragStartRef.current.mouseY;
			const newPos = clampPosition(
				dragStartRef.current.panelX + dx,
				dragStartRef.current.panelY + dy,
				size.width,
				size.height,
			);
			setPosition(newPos);
		},
		[isDragging, size, clampPosition, setPosition],
	);

	const handleDragEnd = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Resize handlers
	const handleResizeStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsResizing(true);
			resizeStartRef.current = {
				mouseX: e.clientX,
				mouseY: e.clientY,
				width: size.width,
				height: size.height,
			};
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
		},
		[size],
	);

	const handleResizeMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isResizing) return;
			const dx = e.clientX - resizeStartRef.current.mouseX;
			const dy = e.clientY - resizeStartRef.current.mouseY;
			const maxWidth = window.innerWidth - position.x - SNAP_MARGIN;
			const maxHeight = window.innerHeight - position.y - SNAP_MARGIN;
			setSize({
				width: Math.max(
					MIN_WIDTH,
					Math.min(maxWidth, resizeStartRef.current.width + dx),
				),
				height: Math.max(
					MIN_HEIGHT,
					Math.min(maxHeight, resizeStartRef.current.height + dy),
				),
			});
		},
		[isResizing, position, setSize],
	);

	const handleResizeEnd = useCallback(() => {
		setIsResizing(false);
	}, []);

	// Clamp position and size to viewport on mount, resize, and when detached
	useEffect(() => {
		if (!isDetached) return;
		const clampToViewport = () => {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const clampedW = Math.min(size.width, vw - SNAP_MARGIN * 2);
			const clampedH = Math.min(size.height, vh - SNAP_MARGIN * 2);
			if (clampedW !== size.width || clampedH !== size.height) {
				setSize({ width: clampedW, height: clampedH });
			}
			const clamped = clampPosition(position.x, position.y, clampedW, clampedH);
			if (clamped.x !== position.x || clamped.y !== position.y) {
				setPosition(clamped);
			}
		};
		clampToViewport();
		window.addEventListener("resize", clampToViewport);
		return () => window.removeEventListener("resize", clampToViewport);
	}, [isDetached, position, size, clampPosition, setPosition, setSize]);

	// Prevent text selection during drag/resize
	useEffect(() => {
		if (!isDragging && !isResizing) return;
		document.body.style.userSelect = "none";
		return () => {
			document.body.style.userSelect = "";
		};
	}, [isDragging, isResizing]);

	return (
		<AnimatePresence>
			{isDetached && (
				<motion.div
					ref={panelRef}
					className="fixed z-50 flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden"
					style={{
						left: position.x,
						top: position.y,
						width: size.width,
						height: size.height,
					}}
					initial={{ opacity: 0, scale: 0.92, y: 20 }}
					animate={{
						opacity: 0.85,
						scale: 1,
						y: 0,
						transition: {
							type: "spring",
							stiffness: 400,
							damping: 30,
						},
					}}
					exit={{
						opacity: 0,
						scale: 0.92,
						y: 20,
						transition: { duration: 0.2, ease: "easeIn" },
					}}
				>
					{/* Title bar — draggable */}
					<div
						className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/60 cursor-grab active:cursor-grabbing select-none shrink-0"
						onPointerDown={handleDragStart}
						onPointerMove={handleDragMove}
						onPointerUp={handleDragEnd}
					>
						<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<GripVertical className="h-3.5 w-3.5" />
							<span>Chat</span>
						</div>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-muted-foreground hover:text-foreground"
										onPointerDown={(e: React.PointerEvent) =>
											e.stopPropagation()
										}
										onClick={() => setDetached(false)}
									/>
								}
							>
								<Minimize2 className="h-3.5 w-3.5" />
							</TooltipTrigger>
							<TooltipContent side="bottom">Dock chat</TooltipContent>
						</Tooltip>
					</div>

					{/* Chat content */}
					<div className="flex-1 overflow-hidden p-2 pt-0">
						<ChatPanel
							projectId={projectId}
							models={models}
							onOpenFile={onOpenFile}
							onStreamingStateChange={onStreamingStateChange}
							hideDetachToggle
						/>
					</div>

					{/* Resize handle — bottom right */}
					<div
						className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
						onPointerDown={handleResizeStart}
						onPointerMove={handleResizeMove}
						onPointerUp={handleResizeEnd}
					>
						<svg
							className="absolute bottom-1 right-1 text-muted-foreground/40"
							width="8"
							height="8"
							viewBox="0 0 8 8"
							aria-hidden="true"
						>
							<path
								d="M8 0L0 8M8 3L3 8M8 6L6 8"
								stroke="currentColor"
								strokeWidth="1.5"
							/>
						</svg>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
