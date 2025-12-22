import { useState, useEffect } from "react";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { ResizableSeparator } from "@/components/preview/ResizableSeparator";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ContainerStartupDisplay } from "@/components/setup/ContainerStartupDisplay";

interface ProjectContentWrapperProps {
  projectId: string;
  models?: ReadonlyArray<{ id: string; name: string; provider: string }>;
}

interface PresenceResponse {
  status: string;
  previewReady: boolean;
  opencodeReady: boolean;
}

export function ProjectContentWrapper({ projectId, models = [] }: ProjectContentWrapperProps) {
  const [showStartupDisplay, setShowStartupDisplay] = useState(true);

  // Use custom resizable panel hook for managing layout with constraints
   const { leftPercent, rightPercent, isDragging, onSeparatorMouseDown } = useResizablePanel({
      projectId,
      minSize: 25,
      maxSize: 75,
      defaultSize: 33.33,
    });

  // Check if containers are already ready on mount
  useEffect(() => {
    const checkContainerStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewerId: `check_${Date.now()}`,
          }),
        });

        if (!response.ok) return;

        const data = (await response.json()) as PresenceResponse;

        // If both preview and opencode are ready, hide startup display
        if (data.previewReady && data.opencodeReady && data.status === "running") {
          setShowStartupDisplay(false);
        }
      } catch {
        // If we can't check, assume containers might be starting
      }
    };

    checkContainerStatus();
  }, [projectId]);

   return (
     <div className="flex-1 flex flex-col overflow-hidden relative">
       {/* Container restart display - shown until startup is complete */}
       {showStartupDisplay && (
         <ContainerStartupDisplay
           projectId={projectId}
           reason="restart"
           onComplete={() => setShowStartupDisplay(false)}
         />
       )}

       {/* Chat and preview panels - shown after startup or if already ready */}
        {!showStartupDisplay && (
          <div
            className="flex-1 flex overflow-hidden relative"
            data-resizable-group
          >
            {/* Chat panel (left) */}
             <div
               className="flex flex-col h-full border-r overflow-hidden"
               style={{ width: `${leftPercent}%` }}
             >
               <ChatPanel projectId={projectId} models={models} />
             </div>

            {/* Draggable separator */}
            <ResizableSeparator onMouseDown={onSeparatorMouseDown} />

            {/* Preview panel (right) */}
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{ width: `${rightPercent}%` }}
            >
              <PreviewPanel projectId={projectId} />
            </div>

            {/* Transparent overlay to capture mouse events during drag */}
            {isDragging && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 50,
                  cursor: "col-resize",
                  backgroundColor: "transparent",
                }}
              />
            )}
          </div>
        )}
     </div>
   );
}
