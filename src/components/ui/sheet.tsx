import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	return (
		<SheetPrimitive.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				"bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
				className,
			)}
			{...props}
		>
			<motion.div
				className="absolute inset-0 bg-black/10"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.15 }}
			/>
		</SheetPrimitive.Backdrop>
	);
}

const slideInVariants = {
	right: {
		initial: { x: "100%" },
		animate: { x: 0 },
		exit: { x: "100%" },
	},
	left: {
		initial: { x: "-100%" },
		animate: { x: 0 },
		exit: { x: "-100%" },
	},
	top: {
		initial: { y: "-100%" },
		animate: { y: 0 },
		exit: { y: "-100%" },
	},
	bottom: {
		initial: { y: "100%" },
		animate: { y: 0 },
		exit: { y: "100%" },
	},
};

const positioningClasses = {
	right: "inset-y-0 right-0 h-full w-3/4 border-l",
	left: "inset-y-0 left-0 h-full w-3/4 border-r",
	top: "inset-x-0 top-0 h-auto border-b",
	bottom: "inset-x-0 bottom-0 h-auto border-t",
};

function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	...props
}: SheetPrimitive.Popup.Props & {
	side?: "top" | "right" | "bottom" | "left";
	showCloseButton?: boolean;
}) {
	const variant = slideInVariants[side];
	const positioning = positioningClasses[side];

	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Popup
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"bg-background fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg",
					positioning,
					"sm:max-w-sm",
					className,
				)}
				{...props}
			>
				<motion.div
					initial={variant.initial}
					animate={variant.animate}
					exit={variant.exit}
					transition={{ duration: 0.25, ease: "easeOut" }}
					className="flex flex-col gap-4"
				>
					{children}
					{showCloseButton && (
						<SheetPrimitive.Close
							data-slot="sheet-close"
							render={
								<Button
									variant="ghost"
									className="absolute top-3 right-3"
									size="icon-sm"
								/>
							}
						>
							<XIcon />
							<span className="sr-only">Close</span>
						</SheetPrimitive.Close>
					)}
				</motion.div>
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("gap-0.5 p-4 flex flex-col", className)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("gap-2 p-4 mt-auto flex flex-col", className)}
			{...props}
		/>
	);
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("text-foreground text-base font-medium", className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: SheetPrimitive.Description.Props) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
