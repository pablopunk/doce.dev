import { cn } from '@/lib/utils';

const navLinkClasses = cn(
  'px-2 py-1.5 rounded-md text-xs/relaxed font-medium',
  'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
  'transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
);

export const NavLinks = () => {
  return (
    <nav className="hidden md:flex items-center gap-1">
      <a href="/" className={navLinkClasses}>
        Projects
      </a>
      <a href="/queue" className={navLinkClasses}>
        Queue
      </a>
      <a href="/settings" className={navLinkClasses}>
        Settings
      </a>
    </nav>
  );
};
