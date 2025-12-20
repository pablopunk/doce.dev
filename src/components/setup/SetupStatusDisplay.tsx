import { useState, useEffect, useRef } from "react";
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

interface CurrentEvent {
  type: "message" | "tool";
  text: string;
  isStreaming?: boolean;
}

const phaseMessages: Record<SetupPhase, PhaseInfo> = {
  "not_started": { message: "Preparing setup...", step: 0, label: "Preparing" },
  "creating_files": { message: "Creating project files...", step: 1, label: "Files" },
  "starting_docker": { message: "Starting containers...", step: 2, label: "Docker" },
  "initializing_agent": { message: "Initializing AI agent...", step: 3, label: "Agent" },
  "sending_prompt": { message: "Building your website...", step: 4, label: "Build" },
  "waiting_completion": { message: "Building your website...", step: 4, label: "Build" },
  "completed": { message: "Setup complete!", step: 5, label: "Done" },
  "failed": { message: "Setup failed", step: 0, label: "Failed" },
};

const TOTAL_STEPS = 5;

// All steps in order for the timeline
const STEPS: Array<{ step: number; label: string }> = [
  { step: 1, label: "Files" },
  { step: 2, label: "Docker" },
  { step: 3, label: "Agent" },
  { step: 4, label: "Build" },
  { step: 5, label: "Done" },
];

// Adaptive polling intervals based on setup phase
const POLLING_INTERVALS: Record<SetupPhase, number> = {
  "not_started": 1000,
  "creating_files": 1500,
  "starting_docker": 2000,
  "initializing_agent": 1500,
  "sending_prompt": 2000,
  "waiting_completion": 3000,
  "completed": 1000,
  "failed": 1000,
};

/**
 * Extract friendly description from a tool call
 * Examples: "Creating index.tsx..." "Editing Layout.tsx..." "Reading package.json..."
 */
function getFriendlyToolDescription(toolName: string, input: unknown): string {
  const inputObj = (input as Record<string, unknown>) || {};
  
  // Extract file path from input
  const filePath = typeof inputObj.filePath === "string" 
    ? inputObj.filePath 
    : typeof inputObj.path === "string" 
    ? inputObj.path 
    : null;
  
  const fileName = filePath ? filePath.split("/").pop() : null;
  
  // Map tool names to friendly descriptions
  const toolDescriptions: Record<string, string> = {
    "read": "Reading",
    "write": "Creating",
    "edit": "Editing",
    "delete": "Deleting",
    "list": "Listing",
    "bash": "Running",
    "glob": "Finding files",
  };
  
  const action = toolDescriptions[toolName] || toolName.charAt(0).toUpperCase() + toolName.slice(1);
  
  if (fileName) {
    return `${action} ${fileName}...`;
  }
  
  return `${action}...`;
}

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
  const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect to opencode event stream when in build phase
  useEffect(() => {
    const isBuildPhase = setupPhase === "sending_prompt" || setupPhase === "waiting_completion";
    
    if (!isBuildPhase || isComplete) {
      // Close event source if we're no longer in build phase
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Open SSE connection to opencode events
    const eventSource = new EventSource(
      `/api/projects/${projectId}/opencode/event`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("chat.event", (e) => {
      try {
        const event = JSON.parse(e.data);
        handleOpencodeEvent(event);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      if (eventSourceRef.current === eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
    };
  }, [projectId, setupPhase, isComplete]);

  const handleOpencodeEvent = (event: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    const { type, payload } = event;

    switch (type) {
      case "chat.message.delta": {
        const { deltaText } = payload as {
          messageId: string;
          deltaText: string;
        };

        setCurrentEvent((prev) => {
          if (prev?.type === "message") {
            return {
              ...prev,
              text: prev.text + deltaText,
              isStreaming: true,
            };
          }

          return {
            type: "message",
            text: deltaText,
            isStreaming: true,
          };
        });
        break;
      }

      case "chat.message.final": {
        setCurrentEvent((prev) => {
          if (prev?.type === "message") {
            return { ...prev, isStreaming: false };
          }
          return prev;
        });
        break;
      }

      case "chat.tool.start": {
        const { name, input } = payload as {
          name: string;
          input: unknown;
        };

        const friendlyText = getFriendlyToolDescription(name, input);

        // Fade transition to new tool
        setIsTransitioning(true);
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
          setCurrentEvent({
            type: "tool",
            text: friendlyText,
            isStreaming: true,
          });
          setIsTransitioning(false);
        }, 300);
        break;
      }

      case "chat.tool.finish": {
        setCurrentEvent((prev) => {
          if (prev?.type === "tool") {
            return { ...prev, isStreaming: false };
          }
          return prev;
        });
        break;
      }

      case "chat.tool.error": {
        setCurrentEvent((prev) => {
          if (prev?.type === "tool") {
            return { ...prev, isStreaming: false };
          }
          return prev;
        });
        break;
      }
    }
  };

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
              // Update URL to canonical form with slug, then reload
              if (data.slug) {
                window.location.href = `/projects/${projectId}/${data.slug}`;
              } else {
                window.location.reload();
              }
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
  const displayMessage = currentEvent?.text || phaseMessages[setupPhase].message;

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
           
           <div className="flex items-center justify-center gap-2 min-h-6">
             {!isFailed && (
               <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
             )}
             {isFailed && (
               <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
             )}
             <p 
               className={`text-sm text-muted-foreground transition-opacity duration-300 ${
                 isTransitioning ? "opacity-0" : "opacity-100"
               }`}
             >
               {displayMessage}
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
