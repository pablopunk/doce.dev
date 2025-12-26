"use client";

import { DockerHealthProvider } from "@/components/providers/DockerHealthProvider";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectsList } from "@/components/projects/ProjectsList";
import type { Project } from "@/server/db/schema";

interface DashboardContentProps {
  projects: Project[];
  models: readonly { id: string; name: string; provider: string; supportsImages?: boolean }[];
  defaultModel: string;
}

export function DashboardContent({ projects, models, defaultModel }: DashboardContentProps) {
  return (
    <DockerHealthProvider>
      <div className="flex flex-col gap-8">
        <CreateProjectForm models={models} defaultModel={defaultModel} />
        <ProjectsList fallback={projects} />
      </div>
    </DockerHealthProvider>
  );
}
