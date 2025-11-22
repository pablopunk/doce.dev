import { copyTemplateToProject } from "@/domain/projects/lib/template-generator";
import { DEFAULT_TEMPLATE_ID } from "@/domain/projects/lib/templates";
import { writeProjectFiles } from "@/lib/file-system";

interface GeneratedFile {
	path: string;
	content: string;
}

export async function generateCode(projectId: string, aiResponse: string) {
	console.log(`[CodeGen] Processing response for project ${projectId}`);

	try {
		// Try to parse JSON response first
		const parsed = JSON.parse(aiResponse);

		if (parsed.files && Array.isArray(parsed.files)) {
			console.log(
				`[CodeGen] Found JSON format with ${parsed.files.length} files`,
			);
			await processFiles(projectId, parsed.files);
			return parsed;
		}
	} catch (error) {
		// If not JSON, try to extract code blocks with file paths
		console.log(`[CodeGen] Not JSON, extracting code blocks...`);
		const files = extractCodeBlocks(aiResponse);
		console.log(`[CodeGen] Extracted ${files.length} code blocks`);

		if (files.length > 0) {
			files.forEach((f, i) => {
				console.log(
					`[CodeGen] File ${i + 1}: ${f.path} (${f.content.length} chars)`,
				);
			});
			await processFiles(projectId, files);
			return { files };
		} else {
			console.warn(
				`[CodeGen] No code blocks found in response. This may indicate:`,
			);
			console.warn(
				`  1. AI ended conversation with only tool calls (check logs for tool-calls finish reason)`,
			);
			console.warn(
				`  2. AI provided explanation without code (request user to be more specific)`,
			);
			console.warn(`  3. Response was truncated or malformed`);
			console.warn(`Response length: ${aiResponse.length} chars`);
			console.warn(
				`First 200 chars: ${aiResponse.substring(0, 200).replace(/\n/g, "\\n")}`,
			);
		}
	}

	return null;
}

async function processFiles(projectId: string, files: GeneratedFile[]) {
	// Write to filesystem only (single source of truth)
	await writeProjectFiles(projectId, files);
}

function extractCodeBlocks(text: string): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// Match code blocks with optional file path: ```tsx file="path/to/file.tsx"
	// Updated regex to handle file= with or without space after language
	const codeBlockRegex =
		/```(?:\w+)?\s*file=["']([^"']+)["']\s*\n([\s\S]*?)```/g;
	let match;
	let fileIndex = 0;

	console.log(
		`[CodeGen] Searching for code blocks in text of ${text.length} chars`,
	);
	console.log(`[CodeGen] First 500 chars:`, text.slice(0, 500));

	while ((match = codeBlockRegex.exec(text)) !== null) {
		const filePath = match[1];
		const content = match[2].trim();

		// Skip code blocks without a file path specified - they're probably examples or explanations
		if (!filePath) {
			console.log(
				`[CodeGen] Skipping code block without file path (${content.length} chars)`,
			);
			continue;
		}

		console.log(
			`[CodeGen] Found code block: path=${filePath}, content length=${content.length}`,
		);

		files.push({
			path: filePath,
			content: content,
		});

		fileIndex++;
	}

	console.log(`[CodeGen] Total files extracted: ${files.length}`);

	return files;
}

export async function generateDefaultProjectStructure(): Promise<
	GeneratedFile[]
> {
	const files = await copyTemplateToProject(DEFAULT_TEMPLATE_ID);
	console.log(
		`Loaded ${files.length} files from ${DEFAULT_TEMPLATE_ID} template`,
	);
	return files;
}
