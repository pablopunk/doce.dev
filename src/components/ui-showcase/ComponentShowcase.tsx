import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Info } from "lucide-react";

export function ComponentShowcase() {
	return (
		<div className="space-y-12">
			{/* Buttons */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Buttons</h2>

				<div className="space-y-6">
					{/* Variants */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Variants</h3>
						<div className="flex flex-wrap gap-4">
							<Button variant="default">Default</Button>
							<Button variant="outline">Outline</Button>
							<Button variant="secondary">Secondary</Button>
							<Button variant="ghost">Ghost</Button>
							<Button variant="destructive">Destructive</Button>
							<Button variant="link">Link</Button>
						</div>
					</div>

					{/* Sizes */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Sizes</h3>
						<div className="flex flex-wrap items-center gap-4">
							<Button size="xs">Extra Small</Button>
							<Button size="sm">Small</Button>
							<Button size="default">Default</Button>
							<Button size="lg">Large</Button>
						</div>
					</div>

					{/* Icon Sizes */}
					<div>
						<h3 className="text-lg font-semibold mb-4">Icon Buttons</h3>
						<div className="flex flex-wrap gap-4">
							<Button size="icon-xs">
								<Check className="size-2.5" />
							</Button>
							<Button size="icon-sm">
								<Check className="size-3" />
							</Button>
							<Button size="icon">
								<Check className="size-3.5" />
							</Button>
							<Button size="icon-lg">
								<Check className="size-4" />
							</Button>
						</div>
					</div>

					{/* States */}
					<div>
						<h3 className="text-lg font-semibold mb-4">States</h3>
						<div className="flex flex-wrap gap-4">
							<Button>Normal</Button>
							<Button disabled>Disabled</Button>
						</div>
					</div>
				</div>
			</section>

			<Separator />

			{/* Badges */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Badges</h2>
				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-semibold mb-3">Variants</h3>
						<div className="flex flex-wrap gap-3">
							<Badge variant="default">Default</Badge>
							<Badge variant="secondary">Secondary</Badge>
							<Badge variant="outline">Outline</Badge>
							<Badge variant="destructive">Destructive</Badge>
							<Badge variant="ghost">Ghost</Badge>
							<Badge variant="link">Link</Badge>
						</div>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-3">With Icons</h3>
						<div className="flex flex-wrap gap-3">
							<Badge variant="default">
								<Check className="size-2.5" /> Success
							</Badge>
							<Badge variant="destructive">
								<X className="size-2.5" /> Error
							</Badge>
							<Badge variant="outline">
								<Info className="size-2.5" /> Info
							</Badge>
						</div>
					</div>
				</div>
			</section>

			<Separator />

			{/* Form Elements */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Form Elements</h2>
				<div className="space-y-6 max-w-md">
					<div className="space-y-2">
						<Label htmlFor="input">Text Input</Label>
						<Input id="input" placeholder="Type something..." />
					</div>

					<div className="space-y-2">
						<Label htmlFor="input-disabled">Disabled Input</Label>
						<Input id="input-disabled" placeholder="Disabled..." disabled />
					</div>

					<div className="space-y-2">
						<Label htmlFor="textarea">Textarea</Label>
						<Textarea
							id="textarea"
							placeholder="Enter multiple lines..."
							rows={3}
						/>
					</div>
				</div>
			</section>

			<Separator />

			{/* Cards */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Cards</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card className="p-6">
						<h3 className="font-semibold mb-2">Card Title</h3>
						<p className="text-sm text-muted-foreground">
							This is a basic card component with some content.
						</p>
					</Card>

					<Card className="p-6 border-primary/50">
						<h3 className="font-semibold mb-2 text-primary">Accent Card</h3>
						<p className="text-sm text-muted-foreground">
							Card with accent border highlighting.
						</p>
					</Card>

					<Card className="p-6 border-destructive/50">
						<h3 className="font-semibold mb-2 text-destructive">Error Card</h3>
						<p className="text-sm text-muted-foreground">
							Card with destructive border highlighting.
						</p>
					</Card>
				</div>
			</section>

			<Separator />

			{/* Typography */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Typography</h2>
				<div className="space-y-4">
					<div>
						<h1 className="text-4xl font-bold">Heading 1</h1>
						<p className="text-sm text-muted-foreground">text-4xl font-bold</p>
					</div>

					<div>
						<h2 className="text-3xl font-bold">Heading 2</h2>
						<p className="text-sm text-muted-foreground">text-3xl font-bold</p>
					</div>

					<div>
						<h3 className="text-2xl font-bold">Heading 3</h3>
						<p className="text-sm text-muted-foreground">text-2xl font-bold</p>
					</div>

					<div>
						<h4 className="text-xl font-bold">Heading 4</h4>
						<p className="text-sm text-muted-foreground">text-xl font-bold</p>
					</div>

					<div>
						<p className="text-base">Body Text (Base)</p>
						<p className="text-sm text-muted-foreground">text-base</p>
					</div>

					<div>
						<p className="text-sm">Small Text</p>
						<p className="text-xs text-muted-foreground">text-sm</p>
					</div>

					<div>
						<p className="text-xs">Extra Small Text</p>
						<p className="text-xs text-muted-foreground">text-xs</p>
					</div>
				</div>
			</section>

			<Separator />

			{/* Spacing */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Spacing Scale</h2>
				<div className="space-y-6">
					{[4, 8, 12, 16, 24, 32, 48].map((size) => (
						<div key={size} className="flex items-center gap-4">
							<div className="w-20 text-sm font-mono text-muted-foreground">
								{size}px
							</div>
							<div
								className="bg-primary"
								style={{ width: `${size * 4}px`, height: "24px" }}
							/>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
