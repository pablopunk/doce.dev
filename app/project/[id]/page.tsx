import { ChatInterface } from "@/components/chat-interface"
import { CodePreview } from "@/components/code-preview"
import { DeploymentList } from "@/components/deployment-list"
import { getProject } from "@/lib/db"
import { notFound } from "next/navigation"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    notFound()
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-muted-foreground hover:text-foreground">
            ← Back
          </a>
          <h1 className="font-semibold">{project.name}</h1>
        </div>
        {project.deployed_url && (
          <a
            href={project.deployed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-600 hover:underline flex items-center gap-1"
          >
            <span className="h-2 w-2 bg-green-600 rounded-full" />
            Live
          </a>
        )}
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex">
          <ChatInterface projectId={id} />
          <CodePreview projectId={id} />
        </div>
        <aside className="w-80 border-l border-border overflow-y-auto p-4">
          <DeploymentList projectId={id} />
        </aside>
      </div>
    </div>
  )
}
