import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { isProjectOwnedByUser, getProjectById } from "@/server/projects/projects.model";
import { listJobs } from "@/server/queue/queue.model";
import type { QueueJobState } from "@/server/queue/queue.model";

const SESSION_COOKIE_NAME = "doce_session";

// Setup job types in order
const SETUP_JOBS = [
  "project.create",
  "docker.composeUp",
  "docker.waitReady",
  "opencode.sessionCreate",
  "opencode.sessionInit",
  "opencode.sendInitialPrompt",
] as const;

interface JobStatus {
  type: string;
  state: QueueJobState | "pending";
  error: string | undefined;
  completedAt: number | undefined;
  createdAt: number | undefined;
}

interface QueueStatusResponse {
  projectId: string;
  currentStep: number; // 0-4 (5 is handled by event stream)
  setupJobs: Record<string, JobStatus>;
  hasError: boolean;
  errorMessage: string | undefined;
  isSetupComplete: boolean;
  promptSentAt: number | undefined; // When opencode.sendInitialPrompt succeeded
  jobTimeoutWarning: string | undefined; // Warning if a job has been running >5 min
}

const JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const GET: APIRoute = async ({ params, cookies }) => {
  // Validate session
  const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = params.id;
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Project ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify project ownership
  const isOwner = await isProjectOwnedByUser(projectId, session.user.id);
  if (!isOwner) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all setup jobs for this project
    const jobs = await listJobs({
      projectId,
      limit: 100,
    });

    // Map jobs by type for quick lookup (get the latest of each type)
    const jobsByType = new Map<string, (typeof jobs)[0]>();
    for (const job of jobs) {
      if (SETUP_JOBS.includes(job.type as any) && !jobsByType.has(job.type)) {
        jobsByType.set(job.type, job);
      }
    }

    // Build response
    const setupJobs: Record<string, JobStatus> = {};
    let currentStep = 0;
    let hasError = false;
    let errorMessage: string | undefined;
    let promptSentAt: number | undefined;
    let isSetupComplete = true;

    for (const jobType of SETUP_JOBS) {
      const job = jobsByType.get(jobType);

      if (!job) {
        // Job not yet created
        setupJobs[jobType] = {
          type: jobType,
          state: "pending",
          error: undefined,
          completedAt: undefined,
          createdAt: undefined,
        };
        isSetupComplete = false;
      } else {
        setupJobs[jobType] = {
          type: jobType,
          state: job.state,
          error: job.lastError || undefined,
          completedAt: job.updatedAt.getTime(),
          createdAt: job.createdAt.getTime(),
        };

        // Handle failures
        if (job.state === "failed") {
          hasError = true;
          errorMessage = job.lastError || `${jobType} failed`;
          isSetupComplete = false;
        }

        // Track current step based on highest succeeded job
        if (job.state === "succeeded") {
          currentStep = SETUP_JOBS.indexOf(jobType) + 1;

          // Track when prompt was sent (for agent timeout detection)
          if (jobType === "opencode.sendInitialPrompt") {
            promptSentAt = job.updatedAt.getTime();
          }
        } else {
          isSetupComplete = false;
        }
      }
    }

    // Check for job timeout warning (if any setup job is stuck for >5 min)
    let jobTimeoutWarning: string | undefined;
    const now = Date.now();
    for (const jobType of SETUP_JOBS) {
      const job = jobsByType.get(jobType);
      if (job && (job.state === "running" || job.state === "queued")) {
        const elapsed = now - job.createdAt.getTime();
        if (elapsed > JOB_TIMEOUT_MS) {
          const minutes = Math.floor(elapsed / 1000 / 60);
          jobTimeoutWarning = `${jobType} has been running for ${minutes} minutes (this usually resolves on its own)`;
          break;
        }
      }
    }

    const response: QueueStatusResponse = {
      projectId,
      currentStep,
      setupJobs,
      hasError,
      errorMessage,
      isSetupComplete,
      promptSentAt,
      jobTimeoutWarning,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
