"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Eye, Code, Rocket, RefreshCw, Loader2, Settings, Plus, Trash2 } from "lucide-react"
import useSWR from "swr"
import { TerminalDock } from "@/components/terminal-dock"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function CodePreview({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "env">("preview")
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [isSavingEnv, setIsSavingEnv] = useState(false)
  const [isCreatingPreview, setIsCreatingPreview] = useState(false)
  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false)
  const { data: project, mutate } = useSWR(`/api/projects/${projectId}`, fetcher, {
    refreshInterval: 2000,
  })

  const { data: envData } = useSWR(`/api/projects/${projectId}/env`, fetcher, {
    refreshInterval: 5000,
  })

  // Load env vars when data changes
  useEffect(() => {
    if (envData?.env) {
      setEnvVars(envData.env)
    }
  }, [envData])

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

  const handleSaveEnv = async () => {
    setIsSavingEnv(true)
    try {
      await fetch(`/api/projects/${projectId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: envVars }),
      })
      // Restart preview to pick up new env vars
      if (project?.preview_url) {
        await handleCreatePreview()
      }
    } catch (error) {
      console.error("Failed to save env vars:", error)
    } finally {
      setIsSavingEnv(false)
    }
  }

  const addEnvVar = () => {
    const key = `NEW_VAR_${Object.keys(envVars).length + 1}`
    setEnvVars({ ...envVars, [key]: "" })
  }

  const updateEnvVar = (oldKey: string, newKey: string, value: string) => {
    const newEnvVars = { ...envVars }
    if (oldKey !== newKey) {
      delete newEnvVars[oldKey]
    }
    newEnvVars[newKey] = value
    setEnvVars(newEnvVars)
  }

  const deleteEnvVar = (key: string) => {
    const newEnvVars = { ...envVars }
    delete newEnvVars[key]
    setEnvVars(newEnvVars)
  }

  return (
    <div className="flex-1 flex flex-col relative">
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
            <TabsTrigger value="env" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Environment
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
      <div className={`flex-1 overflow-auto ${isTerminalExpanded ? 'pb-80' : 'pb-12'}`}>
        {activeTab === "preview" && (
          <div className="h-full min-h-full bg-white">
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
        {activeTab === "env" && (
          <div className="h-full overflow-auto p-4 bg-muted/30">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Environment Variables</h3>
                  <p className="text-sm text-muted-foreground">
                    Variables for development and production
                  </p>
                </div>
                <Button onClick={addEnvVar} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>

              <div className="space-y-2">
                {Object.entries(envVars).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-card p-3 rounded-lg border border-border">
                    <Input
                      placeholder="KEY"
                      value={key}
                      onChange={(e) => updateEnvVar(key, e.target.value, value)}
                      className="flex-1 font-mono text-sm"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      placeholder="value"
                      value={value}
                      onChange={(e) => updateEnvVar(key, key, e.target.value)}
                      className="flex-[2] font-mono text-sm"
                      type="text"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteEnvVar(key)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {Object.keys(envVars).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No environment variables yet. Click "Add Variable" to create one.
                  </div>
                )}
              </div>

              {Object.keys(envVars).length > 0 && (
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveEnv} disabled={isSavingEnv}>
                    {isSavingEnv ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save & Restart Preview"
                    )}
                  </Button>
                </div>
              )}

              <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                <h4 className="font-medium mb-2 text-sm">Usage in your code:</h4>
                <pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto">
                  <code>{`// Access in Astro components
const apiKey = import.meta.env.YOUR_API_KEY

// Access in React components (client-side)
const apiKey = import.meta.env.PUBLIC_YOUR_API_KEY

// Note: Prefix with PUBLIC_ for client-side access`}</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
      <TerminalDock 
        projectId={projectId} 
        isPreviewRunning={!!project?.preview_url}
        isExpanded={isTerminalExpanded}
        onToggle={() => setIsTerminalExpanded(!isTerminalExpanded)}
      />
    </div>
  )
}
