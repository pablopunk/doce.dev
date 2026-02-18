import { assets } from "./assets";
import { auth } from "./auth";
import { projects } from "./projects";
import { providers } from "./providers";
import { queue } from "./queue";
import { settings } from "./settings";
import { setup } from "./setup";
import { update } from "./update";

export const server = {
	setup,
	auth,
	settings,
	projects,
	providers,
	queue,
	assets,
	update,
};
