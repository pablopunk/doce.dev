import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-shadow transition-filter transition-colors duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
	{
		variants: {
			variant: {
default:
"bg-[color:var(--bg-button)] text-[color:var(--text-strong)] font-semibold transition-shadow transition-filter transition-colors duration-200 ease-in-out active:scale-[0.98]",

				destructive:
					"bg-destructive text-white font-semibold shadow-elevation hover:shadow-elevation-lg hover:brightness-110 active:scale-[0.98] transition-shadow transition-filter transition-colors duration-200 ease-in-out",
				outline:
					"bg-bg-surface text-text-strong font-medium hover:bg-bg-raised hover:brightness-105 transition-shadow transition-filter transition-colors duration-200 ease-in-out",
				secondary:
					"bg-bg-raised text-text-strong font-medium hover:bg-bg-surface hover:brightness-105 transition-shadow transition-filter transition-colors duration-200 ease-in-out",
				ghost:
					"text-text-strong hover:bg-bg-raised transition-shadow transition-filter transition-colors duration-200 ease-in-out",
				link: "text-text-strong underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
