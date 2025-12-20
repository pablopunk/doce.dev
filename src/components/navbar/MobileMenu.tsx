'use client';

import { Menu, LayoutGrid, Clock, Settings } from 'lucide-react';
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
         <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-accent transition-colors">
           <Menu className="h-5 w-5" aria-label="Open menu" />
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => (window.location.href = '/')}>
            <LayoutGrid className="w-4 h-4 mr-2" />
            Projects
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = '/queue')}>
            <Clock className="w-4 h-4 mr-2" />
            Queue
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = '/settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
