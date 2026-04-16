import * as fs from "node:fs/promises";
import * as path from "node:path";

const PROJECT_PROMPT_PATH = path.join(".doce", "project-prompt.md");
const MAX_PROMPT_CHARS = 12_000;

async function readOriginalPrompt(directory: string): Promise<string | null> {
	try {
		const filePath = path.join(directory, PROJECT_PROMPT_PATH);
		const content = await fs.readFile(filePath, "utf-8");
		const trimmed = content.trim();
		if (!trimmed) {
			return null;
		}

		if (trimmed.length <= MAX_PROMPT_CHARS) {
			return trimmed;
		}

		return `${trimmed.slice(0, MAX_PROMPT_CHARS)}\n\n[truncated for compaction]`;
	} catch {
		return null;
	}
}

function buildCompactionContext(originalPrompt: string | null): string {
	const originalPromptBlock = originalPrompt
		? originalPrompt
		: "Original project prompt unavailable. Infer the project goal from the most durable signals in the session and codebase.";

	return `## doce.dev Project Anchor

You are compacting a long-running doce.dev build session.
Preserve the project's identity, implementation momentum, and the user's original intent.

### Original Project Prompt
${originalPromptBlock}

### Preserve through compaction
- the core goal of the project
- explicit requirements and constraints
- what has already been implemented
- the current implementation status
- the key technical and product decisions made
- the most important files and code areas involved
- known issues, blockers, or unfinished work
- the immediate next step

### Journey summary requirements
When summarizing the journey so far:
- preserve decisions, implementation state, and next actions over raw logs
- mention abandoned approaches only if they still matter
- prefer the solution currently reflected in the codebase
- keep the continuation implementation-oriented and specific

### Preferred continuation structure
## Project Goal
- ...

## Constraints
- ...

## Progress So Far
- ...

## Key Decisions
- ...

## Important Files
- ...

## Known Issues / Risks
- ...

## Next Step
- ...`;
}

export const DoceCompactionPlugin = async ({ directory }: { directory: string }) => {
	return {
		"experimental.session.compacting": async (_input, output) => {
			const originalPrompt = await readOriginalPrompt(directory);
			output.context.push(buildCompactionContext(originalPrompt));
		},
	};
};
