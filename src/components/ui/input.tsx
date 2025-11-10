import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-10 w-full rounded-md border-border-default-default bg-bg-raised px-3 py-2 text-sm text-text-primary",
					"placeholder:text-text-secondary",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-highlight",
					"hover:border-highlight",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"file:border-0 file:bg-transparent file:text-sm file:font-medium",
					"transition-all shadow-elevation",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
