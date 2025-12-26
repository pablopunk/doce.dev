import React, { useState } from "react";

interface ColorToken {
	name: string;
	variable: string;
	lightValue: string;
	darkValue: string;
}

interface ColorCategory {
	name: string;
	colors: ColorToken[];
}

const colorCategories: ColorCategory[] = [
	{
		name: "Base Colors",
		colors: [
			{
				name: "Background",
				variable: "--background",
				lightValue: "oklch(1 0 0)",
				darkValue: "oklch(0.147 0.004 49.25)",
			},
			{
				name: "Foreground",
				variable: "--foreground",
				lightValue: "oklch(0.147 0.004 49.25)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
			{
				name: "Card",
				variable: "--card",
				lightValue: "oklch(1 0 0)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Card FG",
				variable: "--card-foreground",
				lightValue: "oklch(0.147 0.004 49.25)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
			{
				name: "Popover",
				variable: "--popover",
				lightValue: "oklch(1 0 0)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Popover FG",
				variable: "--popover-foreground",
				lightValue: "oklch(0.147 0.004 49.25)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
		],
	},
	{
		name: "Semantic Colors",
		colors: [
			{
				name: "Primary",
				variable: "--primary",
				lightValue: "oklch(0.216 0.006 56.043)",
				darkValue: "oklch(0.923 0.003 48.717)",
			},
			{
				name: "Primary FG",
				variable: "--primary-foreground",
				lightValue: "oklch(0.985 0.001 106.423)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Secondary",
				variable: "--secondary",
				lightValue: "oklch(0.97 0.001 106.424)",
				darkValue: "oklch(0.268 0.007 34.298)",
			},
			{
				name: "Secondary FG",
				variable: "--secondary-foreground",
				lightValue: "oklch(0.216 0.006 56.043)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
			{
				name: "Muted",
				variable: "--muted",
				lightValue: "oklch(0.97 0.001 106.424)",
				darkValue: "oklch(0.268 0.007 34.298)",
			},
			{
				name: "Muted FG",
				variable: "--muted-foreground",
				lightValue: "oklch(0.553 0.013 58.071)",
				darkValue: "oklch(0.709 0.01 56.259)",
			},
			{
				name: "Accent",
				variable: "--accent",
				lightValue: "oklch(0.216 0.006 56.043)",
				darkValue: "oklch(0.923 0.003 48.717)",
			},
			{
				name: "Accent FG",
				variable: "--accent-foreground",
				lightValue: "oklch(0.985 0.001 106.423)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Destructive",
				variable: "--destructive",
				lightValue: "oklch(0.577 0.245 27.325)",
				darkValue: "oklch(0.704 0.191 22.216)",
			},
		],
	},
	{
		name: "UI Colors",
		colors: [
			{
				name: "Border",
				variable: "--border",
				lightValue: "oklch(0.923 0.003 48.717)",
				darkValue: "oklch(1 0 0 / 10%)",
			},
			{
				name: "Input",
				variable: "--input",
				lightValue: "oklch(0.923 0.003 48.717)",
				darkValue: "oklch(1 0 0 / 15%)",
			},
			{
				name: "Ring",
				variable: "--ring",
				lightValue: "oklch(0.709 0.01 56.259)",
				darkValue: "oklch(0.553 0.013 58.071)",
			},
		],
	},
	{
		name: "Chart Colors",
		colors: [
			{
				name: "Chart 1",
				variable: "--chart-1",
				lightValue: "oklch(0.646 0.222 41.116)",
				darkValue: "oklch(0.488 0.243 264.376)",
			},
			{
				name: "Chart 2",
				variable: "--chart-2",
				lightValue: "oklch(0.6 0.118 184.704)",
				darkValue: "oklch(0.696 0.17 162.48)",
			},
			{
				name: "Chart 3",
				variable: "--chart-3",
				lightValue: "oklch(0.398 0.07 227.392)",
				darkValue: "oklch(0.769 0.188 70.08)",
			},
			{
				name: "Chart 4",
				variable: "--chart-4",
				lightValue: "oklch(0.828 0.189 84.429)",
				darkValue: "oklch(0.627 0.265 303.9)",
			},
			{
				name: "Chart 5",
				variable: "--chart-5",
				lightValue: "oklch(0.769 0.188 70.08)",
				darkValue: "oklch(0.645 0.246 16.439)",
			},
		],
	},
	{
		name: "Sidebar Colors",
		colors: [
			{
				name: "Sidebar",
				variable: "--sidebar",
				lightValue: "oklch(0.985 0.001 106.423)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Sidebar FG",
				variable: "--sidebar-foreground",
				lightValue: "oklch(0.147 0.004 49.25)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
			{
				name: "Sidebar Primary",
				variable: "--sidebar-primary",
				lightValue: "oklch(0.216 0.006 56.043)",
				darkValue: "oklch(0.488 0.243 264.376)",
			},
			{
				name: "Sidebar Primary FG",
				variable: "--sidebar-primary-foreground",
				lightValue: "oklch(0.985 0.001 106.423)",
				darkValue: "oklch(0.985 0.001 106.423)",
			},
			{
				name: "Sidebar Accent",
				variable: "--sidebar-accent",
				lightValue: "oklch(0.216 0.006 56.043)",
				darkValue: "oklch(0.923 0.003 48.717)",
			},
			{
				name: "Sidebar Accent FG",
				variable: "--sidebar-accent-foreground",
				lightValue: "oklch(0.985 0.001 106.423)",
				darkValue: "oklch(0.216 0.006 56.043)",
			},
			{
				name: "Sidebar Border",
				variable: "--sidebar-border",
				lightValue: "oklch(0.923 0.003 48.717)",
				darkValue: "oklch(1 0 0 / 10%)",
			},
			{
				name: "Sidebar Ring",
				variable: "--sidebar-ring",
				lightValue: "oklch(0.709 0.01 56.259)",
				darkValue: "oklch(0.553 0.013 58.071)",
			},
		],
	},
];

const radiusTokens = [
	{ name: "Small", size: "calc(var(--radius) - 4px)" },
	{ name: "Medium", size: "calc(var(--radius) - 2px)" },
	{ name: "Large (Base)", size: "var(--radius)" },
	{ name: "X-Large", size: "calc(var(--radius) + 4px)" },
	{ name: "2X-Large", size: "calc(var(--radius) + 8px)" },
	{ name: "3X-Large", size: "calc(var(--radius) + 12px)" },
	{ name: "4X-Large", size: "calc(var(--radius) + 16px)" },
];

function ColorSwatch({ token }: { token: ColorToken }) {
	const [showDetails, setShowDetails] = useState(false);

	return (
		<div className="group">
			<button
				onClick={() => setShowDetails(!showDetails)}
				title={token.variable}
				className="w-full text-left"
			>
				<div className="mb-1 flex items-center gap-1.5">
					<div
						className="w-6 h-6 rounded border border-border flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-ring transition-all"
						style={{
							backgroundColor: `oklch(${token.lightValue.match(/\d+\.?\d*/g)?.join(" ") || "0 0 0"})`,
						}}
						title={`Light: ${token.lightValue}`}
					/>
					<div
						className="w-6 h-6 rounded border border-border flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-ring transition-all"
						style={{
							backgroundColor: `oklch(${token.darkValue.match(/\d+\.?\d*/g)?.join(" ") || "0 0 0"})`,
						}}
						title={`Dark: ${token.darkValue}`}
					/>
				</div>
				<p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
					{token.name}
				</p>
			</button>

			{showDetails && (
				<div className="mt-2 p-2 bg-muted rounded text-xs space-y-1 border border-border">
					<p className="font-mono text-xs break-all text-muted-foreground">
						{token.variable}
					</p>
					<p className="text-xs break-all">Light: {token.lightValue}</p>
					<p className="text-xs break-all">Dark: {token.darkValue}</p>
				</div>
			)}
		</div>
	);
}

export function ColorPalette() {
	return (
		<div className="space-y-6">
			{/* Color Tokens */}
			<section>
				<h2 className="text-2xl font-bold mb-4">Color Tokens</h2>
				<div className="space-y-5">
					{colorCategories.map((category) => (
						<div key={category.name}>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
								{category.name}
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
								{category.colors.map((token) => (
									<ColorSwatch key={token.variable} token={token} />
								))}
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Border Radius */}
			<section>
				<h2 className="text-2xl font-bold mb-6">Border Radius</h2>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
					{radiusTokens.map((radius) => (
						<div key={radius.name} className="space-y-3">
							<p className="font-semibold text-sm">{radius.name}</p>
							<div
								className="w-full h-24 bg-primary border border-border"
								style={{ borderRadius: radius.size }}
							/>
							<code className="text-xs block text-muted-foreground break-words">
								{radius.size}
							</code>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
