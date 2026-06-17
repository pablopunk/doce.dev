import { ActionError } from "astro:actions";
import type { User } from "@/server/db/schema";

interface UserContext {
	locals: {
		user: User | null;
	};
}

export function requireUser(context: UserContext): User {
	const { user } = context.locals;
	if (!user) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "You must be logged in",
		});
	}

	return user;
}
