import { ProjectList } from "@/components/project-list"
import { CreateProjectButton } from "@/components/create-project-button"
import { SystemStats } from "@/components/system-stats"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">V0 Self-Hosted</h1>
            <p className="text-sm text-muted-foreground">AI Website Builder</p>
          </div>
          <CreateProjectButton />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-8">
        <SystemStats />
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
          <ProjectList />
        </div>
      </main>
    </div>
  )
}
