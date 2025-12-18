'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from './ThemeToggle';

export const MobileMenu = () => {
  return (
    <div className="md:hidden flex items-center gap-2">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => (window.location.href = '/')}>
            Projects
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = '/queue')}>
            Queue
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = '/settings')}>
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
