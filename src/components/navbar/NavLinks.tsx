import { LayoutGrid, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function usePathname() {
	const [pathname, setPathname] = useState("");

	useEffect(() => {
		setPathname(window.location.pathname);
	}, []);

	return pathname;
}

function navLinkClasses(isActive: boolean) {
	return cn(
		"px-3 py-1.5 rounded-md text-xs/relaxed font-medium",
		"transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
		"flex items-center gap-1.5",
		isActive
			? "bg-muted text-foreground"
			: "text-muted-foreground hover:bg-muted hover:text-foreground",
	);
}

export const NavLinks = () => {
	const pathname = usePathname();

	return (
		<nav className="hidden md:flex items-center gap-1">
			<a href="/" className={navLinkClasses(pathname === "/")}>
				<LayoutGrid className="w-4 h-4" />
				Projects
			</a>
			<a href="/settings" className={navLinkClasses(pathname === "/settings")}>
				<Settings className="w-4 h-4" />
				Settings
			</a>
		</nav>
	);
};
