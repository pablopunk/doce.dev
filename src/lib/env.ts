import { mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
	DOCKER_HOST: z.string().default("/var/run/docker.sock"),
	DATA_PATH: z.string().default("./data"),
});

const rawEnv = envSchema.parse(process.env);
const dockerHost = rawEnv.DOCKER_HOST;
const dataPath = rawEnv.DATA_PATH;

const projectsDir = path.join(rawEnv.DATA_PATH, "projects");
const dbPath = path.join(rawEnv.DATA_PATH, "doce.db");

mkdirSync(rawEnv.DATA_PATH, { recursive: true });
mkdirSync(projectsDir, { recursive: true });

const env = {
	dockerHost,
	dataPath,
	projectsDir,
	dbPath,
};

export default env;
