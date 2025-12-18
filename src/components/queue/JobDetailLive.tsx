import { useEffect, useState } from "react";
import type { QueueJob } from "@/server/db/schema";

interface JobStreamData {
  type: "init" | "update";
  job: QueueJob;
  timestamp: string;
}

interface JobDetailLiveProps {
  initialJob: QueueJob;
}

export function JobDetailLive({ initialJob }: JobDetailLiveProps) {
  const [job, setJob] = useState<QueueJob>(initialJob);

  useEffect(() => {
    const eventSource = new EventSource(`/api/queue/job-stream?jobId=${initialJob.id}`);

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as JobStreamData;
        setJob(data.job);
      } catch (err) {
        console.error("Failed to parse job update:", err);
      }
    });

    eventSource.addEventListener("error", (err) => {
      console.error("Job stream error:", err);
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [initialJob.id]);

  const canCancel = job.state === "queued" || job.state === "running";
  const canRunNow = job.state === "queued";
  const canForceUnlock = job.state === "running";
  const canRetry = job.state === "failed" || job.state === "cancelled" || job.state === "succeeded";

  const handleAction = async (action: string) => {
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
        body: JSON.stringify({ jobId: job.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to perform action");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to perform action");
    }
  };

  return (
    <main className="container mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Job</h1>
          <p className="font-mono text-xs text-muted-foreground break-all">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/queue" className="rounded-md border px-3 py-2 text-sm">
            Back
          </a>
          {canCancel && (
            <button
              onClick={() => handleAction("cancel")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          )}
          {canRunNow && (
            <button
              onClick={() => handleAction("runNow")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Run now
            </button>
          )}
          {canRetry && (
            <button
              onClick={() => handleAction("retry")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Retry
            </button>
          )}
          {canForceUnlock && (
            <button
              onClick={() => handleAction("forceUnlock")}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Force unlock
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Summary</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-mono text-xs">{job.type}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">State</dt>
              <dd>{job.state}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Attempts</dt>
              <dd>
                {job.attempts}/{job.maxAttempts}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="font-mono text-xs">{job.projectId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Run At</dt>
              <dd className="font-mono text-xs">{job.runAt.toISOString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-mono text-xs">{job.createdAt.toISOString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-mono text-xs">{job.updatedAt.toISOString()}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Lock</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Locked By</dt>
              <dd className="font-mono text-xs">{job.lockedBy ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Locked At</dt>
              <dd className="font-mono text-xs">{job.lockedAt?.toISOString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Lease Expires</dt>
              <dd className="font-mono text-xs">{job.lockExpiresAt?.toISOString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cancel Requested</dt>
              <dd className="font-mono text-xs">{job.cancelRequestedAt?.toISOString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cancelled At</dt>
              <dd className="font-mono text-xs">{job.cancelledAt?.toISOString() ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Payload</h2>
        <pre className="whitespace-pre-wrap text-xs bg-muted/50 p-3 rounded-md overflow-auto">
          {job.payloadJson}
        </pre>
      </div>

      {job.lastError && (
        <div className="mt-6 rounded-lg border border-destructive/40 p-4">
          <h2 className="font-semibold mb-2 text-destructive">Last Error</h2>
          <pre className="whitespace-pre-wrap text-xs text-destructive">{job.lastError}</pre>
        </div>
      )}
    </main>
  );
}
