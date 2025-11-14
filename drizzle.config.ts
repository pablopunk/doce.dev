import env from "@/lib/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/lib/db/providers/drizzle/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: env.dbPath,
	},
});
