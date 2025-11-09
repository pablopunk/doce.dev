import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Hero() {
	return (
		<section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
			<Badge variant="outline" className="text-white/70 border-white/20">
				Astro + React + Tailwind + shadcn/ui
			</Badge>
			<h1 className="text-balance text-4xl font-bold leading-tight text-white md:text-6xl">
				Build blazing-fast sites with islands of interactivity
			</h1>
			<p className="text-balance text-white/70 md:text-lg">
				Combine Astro's content-first architecture with React components when
				you need client-side interactivity. Styled with Tailwind CSS and
				beautiful shadcn/ui components.
			</p>
			<div className="flex flex-wrap items-center justify-center gap-4">
				<Button asChild>
					<a href="https://docs.astro.build" target="_blank" rel="noreferrer">
						Read the docs
					</a>
				</Button>
				<Button variant="outline" asChild>
					<a href="https://ui.shadcn.com" target="_blank" rel="noreferrer">
						shadcn/ui Components
					</a>
				</Button>
			</div>
		</section>
	);
}
