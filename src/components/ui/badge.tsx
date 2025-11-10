import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-strong focus:ring-offset-2",
	{
		variants: {
			variant: {
				default: "border-transparent bg-cta text-strong hover:bg-cta/80",
				secondary: "border-transparent bg-raised text-muted hover:bg-raised/80",
				destructive: "border-transparent bg-danger text-bg hover:bg-danger/80",
				outline: "text-fg",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
