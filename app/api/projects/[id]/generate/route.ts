import { NextResponse } from "next/server"
import { generateDefaultProjectStructure } from "@/lib/code-generator"
import { writeProjectFiles } from "@/lib/file-system"
import { saveFile } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { template } = await req.json()

  try {
    // Generate default structure
    const files = generateDefaultProjectStructure()

    // Write to file system
    await writeProjectFiles(id, files)

    // Save to database
    for (const file of files) {
      await saveFile(id, file.path, file.content)
    }

    return NextResponse.json({ success: true, filesCreated: files.length })
  } catch (error) {
    console.error("Failed to generate project:", error)
    return NextResponse.json({ error: "Failed to generate project" }, { status: 500 })
  }
}
