"use client"

import { Card } from "@/components/ui/card"
import { Layers, Rocket, Eye, Server } from "lucide-react"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function SystemStats() {
  const { data: stats } = useSWR("/api/stats", fetcher, {
    refreshInterval: 10000,
  })

  if (!stats) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold">{stats.totalProjects}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <Rocket className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deployments</p>
            <p className="text-2xl font-bold">{stats.totalDeployments}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Previews</p>
            <p className="text-2xl font-bold">{stats.activePreviews}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-lg">
            <Server className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Containers</p>
            <p className="text-2xl font-bold">{stats.totalContainers}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
