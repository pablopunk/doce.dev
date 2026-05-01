import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ALLOWED_PROJECT_ICONS } from "@/lib/project-icons";

interface ProjectIconPickerProps {
	value: string;
	onChange: (icon: string) => void;
}

export function ProjectIconPicker({ value, onChange }: ProjectIconPickerProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-sm cursor-pointer hover:bg-muted/80 transition-colors"
				title="Change icon"
			>
				{value}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-2" align="center">
				<div className="grid grid-cols-8 gap-1">
					{ALLOWED_PROJECT_ICONS.map((icon) => (
						<button
							key={icon}
							type="button"
							onClick={() => {
								onChange(icon);
								setOpen(false);
							}}
							className={`flex size-8 items-center justify-center rounded-md text-base transition-colors ${
								icon === value
									? "bg-primary text-primary-foreground"
									: "hover:bg-muted"
							}`}
						>
							{icon}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
