import { useEffect, useState } from "react";
import type { QueueJob } from "@/server/db/schema";
import { QueuePlayerControl } from "./QueuePlayerControl";
import { ConfirmQueueActionDialog } from "./ConfirmQueueActionDialog";
import { Play, X, RotateCcw, AlertCircle, Trash2 } from "lucide-react";

interface QueueStreamData {
  type: "init" | "update";
  jobs: QueueJob[];
  paused: boolean;
  concurrency: number;
  timestamp: string;
}

interface QueueTableLiveProps {
  initialJobs: QueueJob[];
  initialPaused: boolean;
  initialConcurrency?: number;
  filters?: {
    state?: string | undefined;
    type?: string | undefined;
    projectId?: string | undefined;
    q?: string | undefined;
  };
}

export function QueueTableLive({ initialJobs, initialPaused, initialConcurrency = 2, filters = {} }: QueueTableLiveProps) {
  const [jobs, setJobs] = useState<QueueJob[]>(initialJobs);
  const [paused, setPaused] = useState(initialPaused);
  const [concurrency, setConcurrency] = useState(initialConcurrency);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    jobId?: string;
    action: "cancel" | "forceUnlock" | "delete" | "deleteByState";
    state?: "succeeded" | "failed" | "cancelled";
    jobCount?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.state) params.set("state", filters.state);
    if (filters.type) params.set("type", filters.type);
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.q) params.set("q", filters.q);

    const eventSource = new EventSource(`/api/queue/jobs-stream?${params.toString()}`);

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as QueueStreamData;
        setJobs(data.jobs);
        setPaused(data.paused);
        setConcurrency(data.concurrency);
      } catch (err) {
        console.error("Failed to parse queue update:", err);
      }
    });

    eventSource.addEventListener("error", (err) => {
      console.error("Queue stream error:", err);
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [filters]);

  const getStateStyles = (state: QueueJob["state"]) => {
    switch (state) {
      case "succeeded":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "running":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
      case "queued":
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
    }
  };

  const handleToggleQueue = async () => {
    try {
      const action = paused ? "/_actions/queue.resume" : "/_actions/queue.pause";
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle queue");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle queue");
    }
  };

    const handleActionClick = (
      action: "cancel" | "forceUnlock" | "delete",
      jobId: string
    ) => {
      setPendingAction({ jobId, action });
      setDialogOpen(true);
    };

   const handleBulkDelete = (state: "succeeded" | "failed" | "cancelled") => {
     const jobCount = jobs.filter((j) => j.state === state).length;
     setPendingAction({ action: "deleteByState", state, jobCount });
     setDialogOpen(true);
   };

   const handleConfirmAction = async () => {
     if (!pendingAction) return;

     setIsLoading(true);
     try {
       let path = "";
       let body: Record<string, string> = {};

       switch (pendingAction.action) {
         case "cancel":
           path = "/_actions/queue.cancel";
           body = { jobId: pendingAction.jobId! };
           break;
         case "forceUnlock":
           path = "/_actions/queue.forceUnlock";
           body = { jobId: pendingAction.jobId! };
           break;
         case "delete":
           path = "/_actions/queue.deleteJob";
           body = { jobId: pendingAction.jobId! };
           break;
         case "deleteByState":
           path = "/_actions/queue.deleteByState";
           body = { state: pendingAction.state! };
           break;
         default:
           throw new Error("Invalid action");
       }

       const res = await fetch(path, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
       });

       if (!res.ok) {
         throw new Error("Failed to perform action");
       }
     } catch (err) {
       alert(err instanceof Error ? err.message : "Failed to perform action");
     } finally {
       setIsLoading(false);
       setPendingAction(null);
     }
   };

   const handleAction = async (action: string, jobId: string) => {
     if (action === "runNow") {
      try {
        const res = await fetch("/_actions/queue.runNow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });

        if (!res.ok) {
          throw new Error("Failed to run job");
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to run job");
      }
    } else if (action === "retry") {
      try {
        const res = await fetch("/_actions/queue.retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });

        if (!res.ok) {
          throw new Error("Failed to retry job");
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to retry job");
      }
     } else if (action === "cancel" || action === "forceUnlock" || action === "delete") {
       handleActionClick(action, jobId);
    }
  };

  const stats = {
    queued: jobs.filter((j) => j.state === "queued").length,
    running: jobs.filter((j) => j.state === "running").length,
  };

  return (
    <>
      <div className="px-8 py-6 max-w-7xl mx-auto">
         <h1 className="text-2xl font-semibold mb-6">Queue</h1>
         
         <div className="mb-6">
           <QueuePlayerControl
             paused={paused}
             concurrency={concurrency}
             stats={stats}
             onToggleQueue={handleToggleQueue}
           />
         </div>

        <div className="mb-6 flex gap-2">
          {stats.queued === 0 && (
            <>
              {jobs.some((j) => j.state === "succeeded") && (
                <button
                  onClick={() => handleBulkDelete("succeeded")}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {jobs.filter((j) => j.state === "succeeded").length} Succeeded
                </button>
              )}
              {jobs.some((j) => j.state === "failed") && (
                <button
                  onClick={() => handleBulkDelete("failed")}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {jobs.filter((j) => j.state === "failed").length} Failed
                </button>
              )}
              {jobs.some((j) => j.state === "cancelled") && (
                <button
                  onClick={() => handleBulkDelete("cancelled")}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {jobs.filter((j) => j.state === "cancelled").length} Cancelled
                </button>
              )}
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">ID</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">State</th>
                <th className="text-left py-2 px-2">Project</th>
                <th className="text-left py-2 px-2">Created</th>
                <th className="text-left py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-2 text-center text-muted-foreground">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono text-xs">
                      <a href={`/queue/${job.id}`} className="hover:underline text-blue-500">
                        {job.id.slice(0, 8)}
                      </a>
                    </td>
                    <td className="py-2 px-2">{job.type}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${getStateStyles(job.state)}`}>
                        {job.state}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{job.projectId || "—"}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      })}
                    </td>
                     <td className="py-2 px-2 space-x-2 flex">
                       {job.state === "queued" && (
                         <button
                           onClick={() => handleAction("runNow", job.id)}
                           className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                         >
                           <Play className="w-3 h-3" />
                           Run Now
                         </button>
                       )}
                       {(job.state === "queued" || job.state === "running") && (
                         <button
                           onClick={() => handleAction("cancel", job.id)}
                           className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                         >
                           <X className="w-3 h-3" />
                           Cancel
                         </button>
                       )}
                       {job.state === "failed" && (
                         <button
                           onClick={() => handleAction("retry", job.id)}
                           className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center gap-1"
                         >
                           <RotateCcw className="w-3 h-3" />
                           Retry
                         </button>
                       )}
                       {job.state === "running" && (
                         <button
                           onClick={() => handleAction("forceUnlock", job.id)}
                           className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-1"
                         >
                           <AlertCircle className="w-3 h-3" />
                           Force Unlock
                         </button>
                       )}
                       {(job.state === "succeeded" || job.state === "failed" || job.state === "cancelled") && (
                         <button
                           onClick={() => handleAction("delete", job.id)}
                           className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                         >
                           <Trash2 className="w-3 h-3" />
                           Delete
                         </button>
                       )}
                     </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

       {pendingAction && (
         <ConfirmQueueActionDialog
           isOpen={dialogOpen}
           onOpenChange={setDialogOpen}
           onConfirm={handleConfirmAction}
           actionType={pendingAction.action}
           isLoading={isLoading}
           jobCount={pendingAction.jobCount ?? 1}
         />
       )}
    </>
  );
}
