/**
 * File filtering utilities
 * Business logic for which files should be ignored in projects
 */

/**
 * Check if a file path should be ignored
 * Returns true if the file should be excluded from listings
 */
export function shouldIgnoreFile(filePath: string): boolean {
	const ignoredPatterns = [
		/node_modules\//,
		/\.next\//,
		/\.astro\//,
		/dist\//,
		/build\//,
		/out\//,
		/\.cache\//,
		/\.turbo\//,
		/\.vercel\//,
		/\.netlify\//,
		/package-lock\.json$/,
		/yarn\.lock$/,
		/pnpm-lock\.yaml$/,
		/bun\.lockb$/,
		/\.env$/,
		/\.env\.local$/,
		/\.env\.[^/]+$/,
		/\.DS_Store$/,
		/Thumbs\.db$/,
		/\.git\//,
		/\.svn\//,
		/\.hg\//,
		/AGENTS\.md$/,
		/\.vscode\//,
		/\.idea\//,
		/\.vs\//,
		/\*\.swp$/,
		/\*~$/,
		/\.log$/,
		/npm-debug\.log$/,
		/yarn-debug\.log$/,
		/yarn-error\.log$/,
	];

	return ignoredPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Filter an array of files, removing ignored ones
 */
export function filterIgnoredFiles<T extends { filePath: string }>(
	files: T[],
): T[] {
	return files.filter((file) => !shouldIgnoreFile(file.filePath));
}
