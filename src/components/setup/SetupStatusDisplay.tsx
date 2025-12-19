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
  label: string;
}

const phaseMessages: Record<SetupPhase, PhaseInfo> = {
  "not_started": { message: "Preparing setup...", step: 0, label: "Preparing" },
  "creating_files": { message: "Creating project files...", step: 1, label: "Files" },
  "starting_docker": { message: "Starting containers...", step: 2, label: "Docker" },
  "initializing_agent": { message: "Initializing AI agent...", step: 3, label: "Agent" },
  "sending_prompt": { message: "Sending your prompt...", step: 4, label: "Prompt" },
  "waiting_completion": { message: "Building your website...", step: 5, label: "Build" },
  "completed": { message: "Setup complete!", step: 6, label: "Done" },
  "failed": { message: "Setup failed", step: 0, label: "Failed" },
};

const TOTAL_STEPS = 6;

// All steps in order for the timeline
const STEPS: Array<{ step: number; label: string }> = [
  { step: 1, label: "Files" },
  { step: 2, label: "Docker" },
  { step: 3, label: "Agent" },
  { step: 4, label: "Prompt" },
  { step: 5, label: "Build" },
  { step: 6, label: "Done" },
];

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
   const currentStep = phaseMessages[setupPhase].step;

   return (
     <div className="flex-1 flex items-center justify-center px-4">
       <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
         <div className="text-center space-y-6 w-full">
            <h2 className="text-2xl font-semibold">
              {isFailed ? "Setup Failed" : "Setting up your project..."}
            </h2>
            
            {!isFailed && (
              <div className="space-y-4">
                {/* Timeline of all steps */}
                <div className="flex items-center justify-between gap-1 w-full">
                  {STEPS.map((step) => {
                    const isCompleted = currentStep > step.step;
                    const isCurrent = currentStep === step.step;
                    
                    return (
                      <div key={step.step} className="flex flex-col items-center gap-2 flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                            isCurrent
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                              : isCompleted
                              ? "bg-primary/20 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? "✓" : step.step}
                        </div>
                        <span className={`text-xs font-medium line-clamp-1 ${
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2">
              {!isFailed && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
              {isFailed && (
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <p className="text-sm text-muted-foreground">
                {phaseMessages[setupPhase].message}
              </p>
            </div>
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
