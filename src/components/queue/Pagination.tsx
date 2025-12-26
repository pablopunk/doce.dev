import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationProps) {
	const canGoPrev = currentPage > 1;
	const canGoNext = currentPage < totalPages;

	return (
		<div className="flex items-center justify-center gap-4">
			<button
				onClick={() => onPageChange(currentPage - 1)}
				disabled={!canGoPrev}
				className="px-3 py-2 text-sm rounded border border-muted-foreground/30 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
			>
				<ChevronLeft className="w-4 h-4" />
				Previous
			</button>

			<span className="text-sm text-muted-foreground">
				Page {currentPage} of {totalPages}
			</span>

			<button
				onClick={() => onPageChange(currentPage + 1)}
				disabled={!canGoNext}
				className="px-3 py-2 text-sm rounded border border-muted-foreground/30 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
			>
				Next
				<ChevronRight className="w-4 h-4" />
			</button>
		</div>
	);
}
