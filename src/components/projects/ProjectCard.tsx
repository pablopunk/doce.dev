import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Loader2 } from "lucide-react";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { useState } from "react";
import type { Project } from "@/server/db/schema";

interface ProjectCardProps {
  project: Project;
}

const statusColors: Record<string, string> = {
  created: "bg-gray-500",
  starting: "bg-yellow-500",
  running: "bg-green-500",
  stopping: "bg-yellow-500",
  stopped: "bg-gray-500",
  deleting: "bg-red-500",
  error: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  created: "Created",
  starting: "Starting...",
  running: "Running",
  stopping: "Stopping...",
  stopped: "Stopped",
  deleting: "Deleting...",
  error: "Error",
};

export function ProjectCard({ project }: ProjectCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const previewUrl = `http://localhost:${project.devPort}`;
  const isRunning = project.status === "running";
  const isLoading =
    project.status === "starting" ||
    project.status === "stopping" ||
    project.status === "deleting";

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (projectId: string) => {
    setIsDeleting(true);
    // Optimistically remove from UI
    const projectCard = document.querySelector(`[data-project-id="${projectId}"]`);
    projectCard?.classList.add('opacity-50', 'pointer-events-none');

    try {
      const response = await fetch('/_actions/projects.delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        projectCard?.remove();
      } else {
        // Revert on error
        projectCard?.classList.remove('opacity-50', 'pointer-events-none');
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      setIsDeleting(false);
      projectCard?.classList.remove('opacity-50', 'pointer-events-none');
      throw error;
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground truncate mt-1">
                /{project.slug}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-white rounded-full ${statusColors[project.status]}`}
              >
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {statusLabels[project.status]}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {project.prompt}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {isRunning && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                </a>
              )}
              <a href={`/projects/${project.id}/${project.slug}`}>
                <Button variant="default" size="sm">
                  Open
                </Button>
              </a>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDeleteClick}
              disabled={isDeleting || project.status === "deleting"}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <span>Port: {project.devPort}</span>
            {project.model && <span className="ml-3">Model: {project.model}</span>}
          </div>
        </CardContent>
      </Card>

      <DeleteProjectDialog
        projectId={project.id}
        projectName={project.name}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}
