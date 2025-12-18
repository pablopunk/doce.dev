import { useEffect, useState } from "react";
import type { QueueJob } from "@/server/db/schema";

interface QueueStreamData {
  type: "init" | "update";
  jobs: QueueJob[];
  paused: boolean;
  timestamp: string;
}

interface QueueTableLiveProps {
  initialJobs: QueueJob[];
  initialPaused: boolean;
  filters?: {
    state?: string;
    type?: string;
    projectId?: string;
    q?: string;
  };
}

export function QueueTableLive({ initialJobs, initialPaused, filters = {} }: QueueTableLiveProps) {
  const [jobs, setJobs] = useState<QueueJob[]>(initialJobs);
  const [paused, setPaused] = useState(initialPaused);

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

  const handleAction = async (action: string, jobId: string) => {
    if (action === "forceUnlock" && !confirm("Force unlock is destructive. Continue?")) {
      return;
    }

    if (action === "cancel" && !confirm("Cancel this job?")) {
      return;
    }

    try {
      const path =
        action === "cancel"
          ? "/_actions/queue.cancel"
          : action === "retry"
            ? "/_actions/queue.retry"
            : action === "runNow"
              ? "/_actions/queue.runNow"
              : "/_actions/queue.forceUnlock";

      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        throw new Error("Failed to perform action");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to perform action");
    }
  };

  return (
    <div className="px-8 py-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Queue</h1>
        <button
          onClick={handleToggleQueue}
          className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/80"
        >
          {paused ? "Paused" : "Running"}
        </button>
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
                     {new Date(job.createdAt).toISOString().split('T')[0]}
                   </td>
                  <td className="py-2 px-2 space-x-2 flex">
                    {job.state === "queued" && (
                      <button
                        onClick={() => handleAction("runNow", job.id)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Run Now
                      </button>
                    )}
                    {(job.state === "queued" || job.state === "running") && (
                      <button
                        onClick={() => handleAction("cancel", job.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Cancel
                      </button>
                    )}
                    {job.state === "failed" && (
                      <button
                        onClick={() => handleAction("retry", job.id)}
                        className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Retry
                      </button>
                    )}
                    {job.state === "running" && (
                      <button
                        onClick={() => handleAction("forceUnlock", job.id)}
                        className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        Force Unlock
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
  );
}
