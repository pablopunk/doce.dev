import { ALLOWED_PROJECT_ICONS } from "@/lib/project-icons";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { ensureGlobalOpencodeStarted } from "@/server/opencode/runtime";
import {
	generateUniqueCreativeSlug,
	generateUniqueSlug,
	nameToSlug,
} from "@/server/projects/slug";

type ProjectIcon = (typeof ALLOWED_PROJECT_ICONS)[number];

export interface ProjectIdentity {
	name: string;
	icon: ProjectIcon;
	slug: string;
}

const NAMING_SYSTEM_PROMPT = `You are a product identity assistant. Given a project description, generate one short product-like name and choose one emoji icon from the allowed list.

Name requirements:
- Sound like a real polished product, not a file name or literal prompt summary
- Be memorable, brandable, and slightly evocative while still hinting at the product's purpose
- Use 2-3 concise words in Title Case with spaces
- Use only letters, numbers, and spaces
- Maximum 32 characters
- Must be suitable as a human-facing project title
- Avoid generic filler like app, website, html, page, project, created, open, simple, basic
- Avoid copying the user's words verbatim unless they are central to the product concept

Icon requirements:
- Choose exactly one emoji from this allowed list: ${ALLOWED_PROJECT_ICONS.join(" ")}
- Pick the most semantically useful icon for the project, not just the most decorative one
- Use ✨ only when no other icon fits

Examples:
- "full screen click tracker with red circles" → {"name":"Pulse Marker","icon":"🎯"}
- "minimal clock" → {"name":"Chrono Glow","icon":"⏱️"}
- "todo app" → {"name":"Task Flow","icon":"✅"}
- "recipe finder" → {"name":"Pantry Spark","icon":"🍽️"}

Return only compact JSON with keys "name" and "icon". No markdown, no explanation.`;

const TIMEOUT_MS = 10_000;
const MAX_PRODUCT_NAME_LENGTH = 32;
const BANNED_NAME_WORDS = new Set([
	"app",
	"basic",
	"created",
	"html",
	"open",
	"page",
	"project",
	"simple",
	"site",
	"website",
]);

// Priority 1: Always try this model first - it's free and reliable
const PRIMARY_MODEL = {
	providerID: "opencode",
	modelID: "minimax-m2.5-free",
};

function extractTextFromParts(
	parts: Array<{ type: string; text?: string }>,
): string {
	for (const part of parts) {
		if (part.type === "text" && part.text) {
			return part.text.trim();
		}
	}
	return "";
}

function isAllowedProjectIcon(icon: string): icon is ProjectIcon {
	return (ALLOWED_PROJECT_ICONS as readonly string[]).includes(icon);
}

function selectFallbackIcon(prompt: string): ProjectIcon {
	const value = prompt.toLowerCase();
	const matches: Array<[ProjectIcon, string[]]> = [
		["📊", ["dashboard", "analytics", "chart", "stats", "metrics"]],
		["✅", ["todo", "task", "checklist", "kanban", "habit"]],
		["💬", ["chat", "message", "comment", "support"]],
		["📅", ["calendar", "schedule", "booking", "event"]],
		["🎵", ["music", "audio", "song", "sound"]],
		["🎮", ["game", "arcade", "play"]],
		["🖼️", ["image", "photo", "gallery", "canvas"]],
		["🗺️", ["map", "location", "route", "travel"]],
		["💸", ["finance", "budget", "money", "invoice", "payment"]],
		["🎯", ["click", "cursor", "target", "tracker"]],
		["🍽️", ["recipe", "food", "meal", "restaurant"]],
		["🔐", ["password", "security", "auth", "login"]],
		["🔎", ["search", "find", "explore"]],
		["🎨", ["design", "color", "paint", "art"]],
		["🤖", ["ai", "agent", "bot", "automation"]],
	];

	return (
		matches.find(([, words]) =>
			words.some((word) => value.includes(word)),
		)?.[0] ?? "✨"
	);
}

function slugToDisplayName(slug: string): string {
	return slug
		.split("-")
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(" ");
}

function normalizeDisplayName(rawName: string): string {
	return rawName
		.trim()
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.slice(0, MAX_PRODUCT_NAME_LENGTH)
		.trim();
}

function isProductLikeName(name: string): boolean {
	const words = name.split(" ").filter(Boolean);
	return (
		name.length > 0 &&
		name.length <= MAX_PRODUCT_NAME_LENGTH &&
		words.length >= 2 &&
		words.length <= 3 &&
		words.every((word) => !BANNED_NAME_WORDS.has(word.toLowerCase()))
	);
}

async function normalizeAndEnsureUniqueIdentity(
	rawIdentity: ProjectIdentity,
): Promise<ProjectIdentity | null> {
	const name = normalizeDisplayName(rawIdentity.name);
	if (!isProductLikeName(name)) {
		return null;
	}

	return {
		name,
		icon: rawIdentity.icon,
		slug: await generateUniqueSlug(name),
	};
}

function parseModelString(
	model: string,
): { providerID: string; modelID: string } | null {
	// Handle formats like "provider/model" or "provider/model/name"
	const [providerID, ...modelParts] = model.split("/");
	if (providerID && modelParts.length > 0) {
		return {
			providerID,
			modelID: modelParts.join("/"),
		};
	}
	return null;
}

function parseIdentityResponse(rawResponse: string): ProjectIdentity | null {
	const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return null;
	}

	try {
		const parsed = JSON.parse(jsonMatch[0]) as {
			name?: unknown;
			icon?: unknown;
		};
		if (typeof parsed.name !== "string" || typeof parsed.icon !== "string") {
			return null;
		}
		if (!isAllowedProjectIcon(parsed.icon)) {
			return null;
		}
		return {
			name: parsed.name,
			icon: parsed.icon,
			slug: nameToSlug(parsed.name),
		};
	} catch {
		return null;
	}
}

async function generateIdentityWithModel(
	prompt: string,
	model: { providerID: string; modelID: string },
): Promise<ProjectIdentity> {
	await ensureGlobalOpencodeStarted();
	const client = createOpencodeClient();

	const session = await client.session.create({});
	const sessionId = session.data?.id;

	if (!sessionId) {
		throw new Error("Failed to create temporary session for auto-naming");
	}

	try {
		const response = await Promise.race([
			client.session.prompt({
				sessionID: sessionId,
				parts: [{ type: "text" as const, text: prompt }],
				system: NAMING_SYSTEM_PROMPT,
				tools: {},
				model,
			}),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error("Auto-naming timed out")),
					TIMEOUT_MS,
				),
			),
		]);

		const rawResponse = extractTextFromParts(
			(response.data?.parts as Array<{ type: string; text?: string }>) ?? [],
		);

		if (!rawResponse) {
			throw new Error("Empty response from OpenCode");
		}

		const identity = parseIdentityResponse(rawResponse);
		if (!identity) {
			throw new Error("Invalid identity response from OpenCode");
		}

		return identity;
	} finally {
		client.session.delete({ sessionID: sessionId }).catch((err) => {
			logger.debug({ sessionId, err }, "Failed to delete temp naming session");
		});
	}
}

/**
 * Generate a project name using AI via the global OpenCode server.
 * Priority 1: Use opencode/minimax-m2.5-free (always works, free)
 * Priority 2: Use the fallback model if provided and different from primary
 * Priority 3: Use creative random fallback with variety
 *
 * @param prompt - The project description/prompt
 * @param fallbackModel - Optional model string (format: "provider/model") to try if primary fails
 * @returns A unique, creative project name
 */
export async function generateProjectIdentity(
	prompt: string,
	fallbackModel?: string | null,
): Promise<ProjectIdentity> {
	// Try primary model first
	try {
		const rawIdentity = await generateIdentityWithModel(prompt, PRIMARY_MODEL);
		const identity = await normalizeAndEnsureUniqueIdentity(rawIdentity);

		if (!identity) {
			throw new Error("Primary model returned a non-product-like identity");
		}

		logger.info(
			{
				prompt: prompt.slice(0, 80),
				name: identity.name,
				icon: identity.icon,
				model: PRIMARY_MODEL.modelID,
			},
			"Auto-generated project identity via primary model",
		);
		return identity;
	} catch (primaryError) {
		logger.warn(
			{
				error:
					primaryError instanceof Error
						? primaryError.message
						: String(primaryError),
			},
			"Primary auto-naming model failed, trying fallback",
		);
	}

	// Try fallback model if provided and different from primary
	if (fallbackModel) {
		const fallbackModelParsed = parseModelString(fallbackModel);
		if (
			fallbackModelParsed &&
			(fallbackModelParsed.providerID !== PRIMARY_MODEL.providerID ||
				fallbackModelParsed.modelID !== PRIMARY_MODEL.modelID)
		) {
			try {
				const rawIdentity = await generateIdentityWithModel(
					prompt,
					fallbackModelParsed,
				);
				const identity = await normalizeAndEnsureUniqueIdentity(rawIdentity);

				if (!identity) {
					throw new Error(
						"Fallback model returned a non-product-like identity",
					);
				}

				logger.info(
					{
						prompt: prompt.slice(0, 80),
						name: identity.name,
						icon: identity.icon,
						model: fallbackModel,
					},
					"Auto-generated project identity via fallback model",
				);
				return identity;
			} catch (fallbackError) {
				logger.warn(
					{
						error:
							fallbackError instanceof Error
								? fallbackError.message
								: String(fallbackError),
						model: fallbackModel,
					},
					"Fallback auto-naming model also failed",
				);
			}
		}
	}

	// Final fallback: creative random naming
	logger.info(
		{ prompt: prompt.slice(0, 80) },
		"Using creative random fallback for project naming",
	);
	const slug = await generateUniqueCreativeSlug(prompt);
	return {
		name: slugToDisplayName(slug),
		icon: selectFallbackIcon(prompt),
		slug,
	};
}

export async function generateProjectName(
	prompt: string,
	fallbackModel?: string | null,
): Promise<string> {
	const identity = await generateProjectIdentity(prompt, fallbackModel);
	return identity.name;
}
