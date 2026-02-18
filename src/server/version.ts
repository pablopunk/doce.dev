declare const __VERSION__: string;
export const VERSION =
	typeof __VERSION__ !== "undefined"
		? __VERSION__
		: process.env.VERSION || "dev";
