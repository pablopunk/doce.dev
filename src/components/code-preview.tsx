"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Code, Rocket, RefreshCw, Loader2 } from "lucide-react"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function CodePreview({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview")
  const [isCreatingPreview, setIsCreatingPreview] = useState(false)
  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  const { data: project, mutate } = useSWR(`/api/projects/${projectId}`, fetcher, {
    refreshInterval: 2000,
  })

  // Auto-start preview when component mounts if not already running
  useEffect(() => {
    if (project && !project.preview_url && !hasAutoStarted && !isCreatingPreview) {
      setHasAutoStarted(true)
      handleCreatePreview()
    }
  }, [project, hasAutoStarted, isCreatingPreview])

  const handleCreatePreview = async () => {
    setIsCreatingPreview(true)
    try {
      await fetch(`/api/projects/${projectId}/preview`, { method: "POST" })
      mutate()
    } catch (error) {
      console.error("Failed to create preview:", error)
    } finally {
      setIsCreatingPreview(false)
    }
  }

  const handleDeploy = async () => {
    await fetch(`/api/projects/${projectId}/deploy`, { method: "POST" })
    mutate()
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {project?.preview_url && (
            <Button variant="outline" size="sm" onClick={handleCreatePreview} disabled={isCreatingPreview}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={handleDeploy} className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Deploy
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" && (
          <div className="h-full bg-white">
            {project?.preview_url ? (
              <iframe
                key={project.preview_url}
                src={project.preview_url}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-same-origin allow-scripts allow-forms"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">No preview available yet</p>
                  <Button onClick={handleCreatePreview} disabled={isCreatingPreview}>
                    {isCreatingPreview ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Preview...
                      </>
                    ) : (
                      "Create Preview"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "code" && (
          <div className="h-full overflow-auto p-4 bg-muted/30">
            {project?.files && project.files.length > 0 ? (
              <div className="space-y-4">
                {project.files.map((file: any) => (
                  <div key={file.id} className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted px-4 py-2 font-mono text-sm">{file.file_path}</div>
                    <pre className="p-4 overflow-x-auto">
                      <code className="text-sm">{file.content}</code>
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No code generated yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
