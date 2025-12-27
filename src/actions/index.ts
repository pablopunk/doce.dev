import { assets } from "./assets";
import { auth } from "./auth";
import { projects } from "./projects";
import { queue } from "./queue";
import { settings } from "./settings";
import { setup } from "./setup";

export const server = {
	setup,
	auth,
	settings,
	projects,
	queue,
	assets,
};
