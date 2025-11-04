import { NextResponse } from "next/server"
import { getFiles } from "@/lib/db"
import { listProjectFiles } from "@/lib/file-system"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Get files from database
  const dbFiles = await getFiles(id)

  // Get files from file system
  const fsFiles = await listProjectFiles(id)

  return NextResponse.json({
    database: dbFiles,
    filesystem: fsFiles,
  })
}
