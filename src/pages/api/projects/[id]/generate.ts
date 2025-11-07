import type { APIRoute } from "astro";
import { saveFile } from "@/lib/db";
import { generateDefaultProjectStructure } from "@/lib/code-generator";
import { writeProjectFiles } from "@/lib/file-system";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  await request.json().catch(() => ({}));

  try {
    const files = await generateDefaultProjectStructure();
    await writeProjectFiles(id, files);

    for (const file of files) {
      await saveFile(id, file.path, file.content);
    }

    return Response.json({ success: true, filesCreated: files.length });
  } catch (error) {
    console.error("Failed to generate project:", error);
    return Response.json({ error: "Failed to generate project" }, { status: 500 });
  }
};
