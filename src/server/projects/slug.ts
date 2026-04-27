import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";

/**
 * Convert a name to a URL-safe slug.
 */
const MAX_SLUG_WORDS = 4;
const MAX_SLUG_LENGTH = 40;

export function nameToSlug(name: string): string {
	const words = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, " ")
		.split(" ")
		.filter(Boolean)
		.slice(0, MAX_SLUG_WORDS);

	return words
		.join("-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH);
}

/**
 * Check if a slug is already taken.
 */
export async function isSlugTaken(slug: string): Promise<boolean> {
	const existing = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.slug, slug))
		.limit(1);

	return existing.length > 0;
}

/**
 * Generate a unique slug from a name.
 * If the slug already exists, append a numeric suffix.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
	const baseSlug = nameToSlug(name);

	if (!baseSlug) {
		// Fallback for empty slugs
		return generateUniqueSlug("project");
	}

	// Check if base slug is available
	if (!(await isSlugTaken(baseSlug))) {
		return baseSlug;
	}

	// Try adding numeric suffixes
	for (let i = 2; i <= 100; i++) {
		const candidateSlug = `${baseSlug}-${i}`;
		if (!(await isSlugTaken(candidateSlug))) {
			return candidateSlug;
		}
	}

	// If we've exhausted 100 attempts, add a random suffix
	const randomSuffix = Math.random().toString(36).substring(2, 8);
	return `${baseSlug}-${randomSuffix}`;
}

// Creative word pools for generating unique, evocative project names
const CREATIVE_ADJECTIVES = [
	"amber",
	"azure",
	"brisk",
	"bold",
	"bright",
	"calm",
	"chill",
	"cool",
	"crisp",
	"deep",
	"drift",
	"eager",
	"early",
	"ember",
	"faint",
	"fair",
	"fast",
	"flash",
	"frost",
	"gentle",
	"gleam",
	"glow",
	"grace",
	"grand",
	"happy",
	"hazy",
	"hush",
	"jade",
	"keen",
	"light",
	"lively",
	"lunar",
	"lush",
	"mellow",
	"misty",
	"neat",
	"nifty",
	"noble",
	"opal",
	"pale",
	"prime",
	"proud",
	"pulse",
	"quiet",
	"rapid",
	"rosy",
	"royal",
	"rush",
	"sage",
	"sharp",
	"sheer",
	"shy",
	"silk",
	"sleek",
	"sly",
	"smooth",
	"snap",
	"soft",
	"solar",
	"solid",
	"sonic",
	"spark",
	"spry",
	"steel",
	"still",
	"stout",
	"swift",
	"tender",
	"tidy",
	"tiny",
	"topaz",
	"trim",
	"true",
	"velvet",
	"vivid",
	"warm",
	"wild",
	"wise",
	"witty",
	"zest",
	"zesty",
];

const CREATIVE_NOUNS = [
	"arc",
	"beam",
	"bite",
	"bloom",
	"breeze",
	"brook",
	"burst",
	"cascade",
	"chip",
	"chorus",
	"chronos",
	"clover",
	"cove",
	"crest",
	"crystal",
	"curl",
	"dash",
	"dawn",
	"dew",
	"dot",
	"drift",
	"drop",
	"edge",
	"ember",
	"fable",
	"field",
	"flare",
	"flash",
	"flick",
	"flow",
	"flux",
	"foam",
	"fringe",
	"gale",
	"glimpse",
	"glow",
	"grace",
	"grain",
	"grove",
	"halo",
	"heart",
	"hue",
	"iris",
	"jet",
	"leaf",
	"line",
	"loom",
	"loop",
	"mist",
	"moon",
	"moss",
	"nectar",
	"nest",
	"night",
	"node",
	"nova",
	"nook",
	"palm",
	"path",
	"peak",
	"pearl",
	"petal",
	"plume",
	"point",
	"pond",
	"pool",
	"pulse",
	"ray",
	"reed",
	"ridge",
	"ring",
	"ripple",
	"rise",
	"river",
	"rock",
	"root",
	"rush",
	"sage",
	"sail",
	"sand",
	"shade",
	"shadow",
	"shard",
	"shell",
	"shift",
	"shine",
	"shoal",
	"shore",
	"sky",
	"sleek",
	"slope",
	"smoke",
	"snow",
	"soar",
	"song",
	"sound",
	"spark",
	"speck",
	"sphere",
	"spike",
	"spin",
	"spire",
	"splash",
	"spring",
	"sprout",
	"spur",
	"star",
	"stem",
	"step",
	"stone",
	"storm",
	"strand",
	"streak",
	"stream",
	"stripe",
	"summer",
	"summit",
	"sun",
	"surf",
	"swell",
	"swirl",
	"tide",
	"time",
	"tone",
	"toss",
	"touch",
	"trace",
	"track",
	"trail",
	"trim",
	"twig",
	"twine",
	"twirl",
	"twist",
	"vale",
	"valley",
	"vapor",
	"veil",
	"vein",
	"verse",
	"vessel",
	"view",
	"vista",
	"voice",
	"wake",
	"walk",
	"wave",
	"way",
	"weave",
	"web",
	"wedge",
	"whirl",
	"whisper",
	"wild",
	"willow",
	"wind",
	"wing",
	"wish",
	"wood",
	"wool",
	"world",
	"yarn",
	"year",
	"zone",
];

const TECH_CONCEPTS = [
	"algo",
	"api",
	"app",
	"bit",
	"byte",
	"chip",
	"code",
	"core",
	"cube",
	"data",
	"dev",
	"disk",
	"file",
	"grid",
	"hash",
	"hub",
	"key",
	"link",
	"load",
	"log",
	"map",
	"net",
	"node",
	"os",
	"pad",
	"port",
	"query",
	"ram",
	"rom",
	"route",
	"stack",
	"sync",
	"tag",
	"task",
	"tool",
	"unit",
	"user",
	"web",
	"widget",
	"wire",
	"zip",
];

const COLORS = [
	"azure",
	"beige",
	"black",
	"blue",
	"brown",
	"buff",
	"burgundy",
	"cerulean",
	"charcoal",
	"chocolate",
	"cobalt",
	"copper",
	"coral",
	"cream",
	"crimson",
	"cyan",
	"denim",
	"emerald",
	"fuchsia",
	"gold",
	"gray",
	"green",
	"indigo",
	"ivory",
	"jade",
	"lavender",
	"lime",
	"magenta",
	"maroon",
	"mauve",
	"navy",
	"olive",
	"orange",
	"orchid",
	"peach",
	"periwinkle",
	"pink",
	"plum",
	"purple",
	"red",
	"rose",
	"ruby",
	"rust",
	"salmon",
	"sapphire",
	"scarlet",
	"sepia",
	"silver",
	"slate",
	"tan",
	"teal",
	"terra",
	"thistle",
	"tomato",
	"turquoise",
	"violet",
	"wheat",
	"white",
	"yellow",
];

function getRandomElement<T>(array: [T, ...T[]] | T[]): T {
	const element = array[Math.floor(Math.random() * array.length)];
	if (element === undefined) {
		throw new Error("Cannot pick a random element from an empty array");
	}
	return element;
}

function getMultipleRandomElements<T>(array: T[], count: number): T[] {
	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
}

/**
 * Extract meaningful keywords from a prompt.
 */
function extractKeywords(prompt: string): string[] {
	// Remove common filler words and extract potential keywords
	const fillerWords = new Set([
		"a",
		"an",
		"the",
		"and",
		"or",
		"but",
		"in",
		"on",
		"at",
		"to",
		"for",
		"of",
		"with",
		"by",
		"from",
		"up",
		"about",
		"into",
		"through",
		"during",
		"before",
		"after",
		"above",
		"below",
		"between",
		"among",
		"is",
		"are",
		"was",
		"were",
		"be",
		"been",
		"being",
		"have",
		"has",
		"had",
		"do",
		"does",
		"did",
		"will",
		"would",
		"could",
		"should",
		"may",
		"might",
		"can",
		"this",
		"that",
		"these",
		"those",
		"i",
		"you",
		"he",
		"she",
		"it",
		"we",
		"they",
		"me",
		"him",
		"her",
		"us",
		"them",
		"my",
		"your",
		"his",
		"its",
		"our",
		"their",
		"create",
		"build",
		"make",
		"generate",
		"using",
		"use",
		"based",
		"simple",
		"basic",
		"advanced",
		"modern",
	]);

	return prompt
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((word) => word.length > 2 && !fillerWords.has(word))
		.slice(0, 5);
}

/**
 * Generate a creative, unique slug with variety.
 * Combines prompt keywords with random creative elements.
 */
export function generateCreativeSlug(prompt: string): string {
	const keywords = extractKeywords(prompt);

	// Different naming strategies to ensure variety
	const strategies = [
		// Adjective + Noun (e.g., "amber-tide", "swift-node")
		() =>
			`${getRandomElement(CREATIVE_ADJECTIVES)}-${getRandomElement(CREATIVE_NOUNS)}`,

		// Color + Tech (e.g., "azure-api", "crimson-code")
		() => `${getRandomElement(COLORS)}-${getRandomElement(TECH_CONCEPTS)}`,

		// Adjective + Tech (e.g., "sleek-hub", "wild-data")
		() =>
			`${getRandomElement(CREATIVE_ADJECTIVES)}-${getRandomElement(TECH_CONCEPTS)}`,

		// Noun + Tech (e.g., "wave-api", "ember-code")
		() =>
			`${getRandomElement(CREATIVE_NOUNS)}-${getRandomElement(TECH_CONCEPTS)}`,

		// Color + Noun (e.g., "silver-stream", "jade-grove")
		() => `${getRandomElement(COLORS)}-${getRandomElement(CREATIVE_NOUNS)}`,

		// Two adjectives + Noun (e.g., "wild-sage-drift")
		() => {
			const [adj1, adj2] = getMultipleRandomElements(CREATIVE_ADJECTIVES, 2);
			return `${adj1}-${adj2}-${getRandomElement(CREATIVE_NOUNS)}`;
		},

		// Keyword + Creative element (e.g., "clock-ember", "task-veil")
		() => {
			if (keywords.length > 0) {
				const keyword = getRandomElement(keywords).slice(0, 8); // Limit keyword length
				const suffix =
					Math.random() > 0.5
						? getRandomElement(CREATIVE_NOUNS)
						: getRandomElement(COLORS);
				return `${keyword}-${suffix}`;
			}
			return `${getRandomElement(CREATIVE_ADJECTIVES)}-${getRandomElement(CREATIVE_NOUNS)}`;
		},

		// Random 2-3 word combination
		() => {
			const pool = [
				...CREATIVE_ADJECTIVES,
				...CREATIVE_NOUNS,
				...COLORS,
				...TECH_CONCEPTS,
			];
			const words = getMultipleRandomElements(
				pool,
				Math.random() > 0.5 ? 2 : 3,
			);
			return words.join("-");
		},
	];

	// Pick a random strategy and generate
	const strategy = getRandomElement(strategies);
	let slug = strategy();

	// Clean up and limit length
	slug = slug
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH);

	return slug || "creative-project";
}

/**
 * Generate a unique creative slug, checking for conflicts.
 * If the slug exists, appends a random suffix.
 */
export async function generateUniqueCreativeSlug(
	prompt: string,
): Promise<string> {
	const baseSlug = generateCreativeSlug(prompt);

	if (!(await isSlugTaken(baseSlug))) {
		return baseSlug;
	}

	// Generate new creative slugs until we find a unique one
	for (let i = 0; i < 50; i++) {
		const newSlug = generateCreativeSlug(prompt);
		if (!(await isSlugTaken(newSlug))) {
			return newSlug;
		}
	}

	// Fallback: add random suffix to ensure uniqueness
	const randomSuffix = Math.random().toString(36).substring(2, 6);
	return `${baseSlug}-${randomSuffix}`;
}
