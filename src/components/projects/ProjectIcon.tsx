interface ProjectIconProps {
	icon?: string | null;
	name?: string;
	className?: string;
}

export function ProjectIcon({ icon, name, className }: ProjectIconProps) {
	return (
		<span
			aria-hidden="true"
			title={name ? `${name} icon` : undefined}
			className={
				className ??
				"inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-lg"
			}
		>
			{icon || "✨"}
		</span>
	);
}
