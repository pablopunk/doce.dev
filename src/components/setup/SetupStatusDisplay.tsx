import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetupStatusDisplayProps {
  projectId: string;
  initialSetupPhase: string;
}

type SetupPhase = 
  | "not_started"
  | "creating_files"
  | "starting_docker"
  | "initializing_agent"
  | "sending_prompt"
  | "waiting_completion"
  | "completed"
  | "failed";

const phaseMessages: Record<SetupPhase, string> = {
  "not_started": "Preparing setup...",
  "creating_files": "Creating project files...",
  "starting_docker": "Starting containers...",
  "initializing_agent": "Initializing AI agent...",
  "sending_prompt": "Sending your prompt...",
  "waiting_completion": "Building your website...",
  "completed": "Setup complete!",
  "failed": "Setup failed",
};

export function SetupStatusDisplay({
  projectId,
  initialSetupPhase,
}: SetupStatusDisplayProps) {
  const [setupPhase, setSetupPhase] = useState<SetupPhase>(
    (initialSetupPhase as SetupPhase) || "not_started"
  );
  const [isComplete, setIsComplete] = useState(initialSetupPhase === "completed");

  useEffect(() => {
    if (isComplete) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewerId: `setup_poll_${Date.now()}`,
          }),
        });

        if (!response.ok) return;

        const data = await response.json();
        const newPhase = data.setupPhase as SetupPhase;
        
        setSetupPhase(newPhase);

        if (newPhase === "completed") {
          setIsComplete(true);
          clearInterval(pollInterval);
          // Reload page to show chat + preview
          window.location.reload();
        }
      } catch (error) {
        console.error("Failed to poll setup status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [projectId, isComplete]);

  const isFailed = setupPhase === "failed";

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-md">
        {isFailed ? (
          <AlertTriangle className="h-16 w-16 text-red-500" />
        ) : (
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        )}

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">
            {isFailed ? "Setup Failed" : "Setting up your project..."}
          </h2>
          <p className="text-sm text-muted-foreground">
            {phaseMessages[setupPhase]}
          </p>
        </div>

        {isFailed && (
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
