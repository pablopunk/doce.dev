/**
 * Default SWR fetcher with JSON parsing and error handling
 */
export const fetcher = async <T = unknown>(url: string): Promise<T> => {
	const response = await fetch(url);

	if (!response.ok) {
		const error = new Error("Failed to fetch data");
		throw error;
	}

	return response.json() as Promise<T>;
};
