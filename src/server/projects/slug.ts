import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Convert a name to a URL-safe slug.
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
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
