import { Clock, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinkClasses = cn(
	"px-3 py-1.5 rounded-md text-xs/relaxed font-medium",
	"hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
	"transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
	"flex items-center gap-1.5",
);

export const NavLinks = () => {
	return (
		<nav className="hidden md:flex items-center gap-1">
			<a href="/" className={navLinkClasses}>
				<LayoutGrid className="w-4 h-4" />
				Projects
			</a>
			<a href="/queue" className={navLinkClasses}>
				<Clock className="w-4 h-4" />
				Queue
			</a>
			<a href="/settings" className={navLinkClasses}>
				<Settings className="w-4 h-4" />
				Settings
			</a>
		</nav>
	);
};
