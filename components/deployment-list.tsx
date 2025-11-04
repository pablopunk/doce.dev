"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ExternalLink, Trash2, CheckCircle, XCircle } from "lucide-react"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function DeploymentList({ projectId }: { projectId: string }) {
  const { data, mutate } = useSWR(`/api/projects/${projectId}/deploy`, fetcher, { refreshInterval: 5000 })

  const handleDelete = async (deploymentId: string) => {
    if (confirm("Are you sure you want to stop this deployment?")) {
      await fetch(`/api/deployments/${deploymentId}`, { method: "DELETE" })
      mutate()
    }
  }

  if (!data?.deployments) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Deployments</h3>
      {data.deployments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deployments yet</p>
      ) : (
        <div className="space-y-2">
          {data.deployments.map((deployment: any) => (
            <Card key={deployment.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {deployment.status === "running" ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-mono text-sm">{deployment.url}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(deployment.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(deployment.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
