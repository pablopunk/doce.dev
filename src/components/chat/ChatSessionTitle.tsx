import { Skeleton } from "@/components/ui/skeleton";

interface ChatSessionTitleProps {
	title: string | null;
	isLoading?: boolean;
}

const FALLBACK_TITLE = "New conversation";

export function ChatSessionTitle({
	title,
	isLoading = false,
}: ChatSessionTitleProps) {
	if (isLoading) {
		return <Skeleton className="h-4 w-32" />;
	}

	return (
		<span className="min-w-0 truncate text-sm font-medium">
			{title?.trim() || FALLBACK_TITLE}
		</span>
	);
}
