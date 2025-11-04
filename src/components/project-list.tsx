"use client"

import useSWR from "swr"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Trash2, Eye, Rocket } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function ProjectList() {
  const { data: projects, mutate } = useSWR("/api/projects", fetcher)

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      await fetch(`/api/projects/${id}`, { method: "DELETE" })
      mutate()
    }
  }

  if (!projects) {
    return <div className="text-center py-8">Loading projects...</div>
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
        <p className="text-muted-foreground">Create your first project to get started</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project: any) => (
        <Card key={project.id} className="p-4 hover:shadow-lg transition-shadow">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{project.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {project.preview_url && (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Badge>
                )}
                {project.deployed_url && (
                  <Badge variant="default" className="text-xs bg-green-600">
                    <Rocket className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="default" size="sm" className="flex-1">
                <a href={`/project/${project.id}`}>Open</a>
              </Button>
              {project.deployed_url && (
                <Button asChild variant="outline" size="sm">
                  <a href={project.deployed_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Updated {new Date(project.updated_at).toLocaleDateString()}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
