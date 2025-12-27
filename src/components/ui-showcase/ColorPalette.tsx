import React, { useEffect, useState } from "react";

interface ColorToken {
	variable: string;
}

interface ColorCategory {
	name: string;
	colors: ColorToken[];
}

const colorCategories: ColorCategory[] = [
	{
		name: "Base Colors",
		colors: [
			{ variable: "--background" },
			{ variable: "--foreground" },
			{ variable: "--card" },
			{ variable: "--card-foreground" },
			{ variable: "--popover" },
			{ variable: "--popover-foreground" },
		],
	},
	{
		name: "Semantic Colors",
		colors: [
			{ variable: "--primary" },
			{ variable: "--primary-foreground" },
			{ variable: "--secondary" },
			{ variable: "--secondary-foreground" },
			{ variable: "--muted" },
			{ variable: "--muted-foreground" },
			{ variable: "--accent" },
			{ variable: "--accent-foreground" },
			{ variable: "--destructive" },
			{ variable: "--success" },
			{ variable: "--success-foreground" },
		],
	},
	{
		name: "UI Colors",
		colors: [
			{ variable: "--border" },
			{ variable: "--input" },
			{ variable: "--ring" },
		],
	},
	{
		name: "Chart Colors",
		colors: [
			{ variable: "--chart-1" },
			{ variable: "--chart-2" },
			{ variable: "--chart-3" },
			{ variable: "--chart-4" },
			{ variable: "--chart-5" },
		],
	},
	{
		name: "Sidebar Colors",
		colors: [
			{ variable: "--sidebar" },
			{ variable: "--sidebar-foreground" },
			{ variable: "--sidebar-primary" },
			{ variable: "--sidebar-primary-foreground" },
			{ variable: "--sidebar-accent" },
			{ variable: "--sidebar-accent-foreground" },
			{ variable: "--sidebar-border" },
			{ variable: "--sidebar-ring" },
		],
	},
];

const radiusTokens = [
	{ variable: "calc(var(--radius) - 4px)" },
	{ variable: "calc(var(--radius) - 2px)" },
	{ variable: "var(--radius)" },
	{ variable: "calc(var(--radius) + 4px)" },
	{ variable: "calc(var(--radius) + 8px)" },
	{ variable: "calc(var(--radius) + 12px)" },
	{ variable: "calc(var(--radius) + 16px)" },
];

function getComputedColorValue(variable: string): string {
	if (typeof window === "undefined") return "";
	const root = document.documentElement;
	return getComputedStyle(root).getPropertyValue(variable).trim();
}

function ColorSwatch({ token }: { token: ColorToken }) {
	const [computedValue, setComputedValue] = useState("");

	useEffect(() => {
		setComputedValue(getComputedColorValue(token.variable));
	}, [token.variable]);

	return (
		<div className="flex flex-col items-center gap-1">
			<div
				className="w-8 h-8 rounded border border-border cursor-pointer hover:ring-2 hover:ring-ring transition-all"
				title={computedValue || "Loading..."}
				style={{
					backgroundColor: `var(${token.variable})`,
				}}
			/>
			<p className="text-xs font-mono text-muted-foreground text-center truncate w-full">
				{token.variable}
			</p>
		</div>
	);
}

export function ColorPalette() {
	return (
		<div className="space-y-4">
			{/* Color Tokens */}
			<section>
				<h2 className="text-lg font-bold mb-3">Color Tokens</h2>
				<div className="space-y-3">
					{colorCategories.map((category) => (
						<div key={category.name}>
							<h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
								{category.name}
							</h3>
							<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
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
				<h2 className="text-lg font-bold mb-3">Border Radius</h2>
				<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
					{radiusTokens.map((radius, idx) => (
						<div key={idx} className="space-y-1">
							<div
								className="w-full h-12 bg-primary border border-border"
								style={{ borderRadius: radius.variable }}
							/>
							<code className="text-xs block text-muted-foreground break-words leading-tight">
								{radius.variable}
							</code>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
