import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetupStatusDisplayProps {
  projectId: string;
  initialSetupPhase: string;
  initialSetupError?: string | null;
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

interface PhaseInfo {
  message: string;
  step: number;
}

const phaseMessages: Record<SetupPhase, PhaseInfo> = {
  "not_started": { message: "Preparing setup...", step: 0 },
  "creating_files": { message: "Creating project files...", step: 1 },
  "starting_docker": { message: "Starting containers...", step: 2 },
  "initializing_agent": { message: "Initializing AI agent...", step: 3 },
  "sending_prompt": { message: "Sending your prompt...", step: 4 },
  "waiting_completion": { message: "Building your website...", step: 5 },
  "completed": { message: "Setup complete!", step: 6 },
  "failed": { message: "Setup failed", step: 0 },
};

const TOTAL_STEPS = 6;

// Adaptive polling intervals based on setup phase
// Earlier phases need faster feedback, later phases are slower anyway
const POLLING_INTERVALS: Record<SetupPhase, number> = {
  "not_started": 1000,         // 1 second for immediate start feedback
  "creating_files": 1500,      // 1.5 seconds for file operations
  "starting_docker": 2000,     // 2 seconds for container startup
  "initializing_agent": 1500,  // 1.5 seconds for agent initialization  
  "sending_prompt": 2000,      // 2 seconds for prompt sending
  "waiting_completion": 3000,  // 3 seconds for long-running build
  "completed": 1000,           // 1 second (shouldn't be polled but for safety)
  "failed": 1000,              // 1 second (shouldn't be polled but for safety)
};

export function SetupStatusDisplay({
  projectId,
  initialSetupPhase,
  initialSetupError,
}: SetupStatusDisplayProps) {
  const [setupPhase, setSetupPhase] = useState<SetupPhase>(
    (initialSetupPhase as SetupPhase) || "not_started"
  );
  const [setupError, setSetupError] = useState<string | null>(initialSetupError ?? null);
  const [isComplete, setIsComplete] = useState(initialSetupPhase === "completed");

  useEffect(() => {
     if (isComplete) return;

     let intervalId: ReturnType<typeof setInterval> | null = null;

     const startPolling = (phase: SetupPhase) => {
       const interval = POLLING_INTERVALS[phase];
       
       const poll = async () => {
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
           
           // If phase changed, restart with new interval
           if (newPhase !== phase) {
             if (intervalId) clearInterval(intervalId);
             setSetupPhase(newPhase);
             setSetupError(data.setupError ?? null);
             
             if (newPhase === "completed") {
               setIsComplete(true);
               // Reload page to show chat + preview
               window.location.reload();
             } else {
               startPolling(newPhase);
             }
           } else {
             // Same phase, update error if any
             setSetupError(data.setupError ?? null);
           }
         } catch (error) {
           console.error("Failed to poll setup status:", error);
         }
       };

       intervalId = setInterval(poll, interval);
       // Run first poll immediately
       poll();
     };

     startPolling(setupPhase);

     return () => {
       if (intervalId) clearInterval(intervalId);
     };
   }, [projectId, isComplete, setupPhase]);

  const isFailed = setupPhase === "failed";

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-md">
        {isFailed ? (
          <AlertTriangle className="h-16 w-16 text-red-500" />
        ) : (
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        )}

        <div className="text-center space-y-4">
           <h2 className="text-2xl font-semibold">
             {isFailed ? "Setup Failed" : "Setting up your project..."}
           </h2>
           
           {!isFailed && (
             <div className="flex items-center justify-center gap-2">
               <span className="text-sm font-medium text-primary">
                 Step {phaseMessages[setupPhase].step} of {TOTAL_STEPS}
               </span>
               <div className="h-1.5 bg-secondary rounded-full w-32">
                 <div 
                   className="h-full bg-primary rounded-full transition-all duration-300"
                   style={{ width: `${(phaseMessages[setupPhase].step / TOTAL_STEPS) * 100}%` }}
                 />
               </div>
             </div>
           )}
           
           <p className="text-sm text-muted-foreground">
             {phaseMessages[setupPhase].message}
           </p>
           {isFailed && setupError && (
             <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-left">
               <p className="text-xs text-red-800 break-words">
                 <span className="font-semibold">Error: </span>
                 {setupError}
               </p>
             </div>
           )}
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
