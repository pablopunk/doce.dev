import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, type Message } from "./ChatMessage";
import { type ToolCall } from "./ToolCallDisplay";
import { ToolCallGroup } from "./ToolCallGroup";
import { ChatInput } from "./ChatInput";
import { Loader2 } from "lucide-react";

interface ChatPanelProps {
  projectId: string;
}

interface ChatItem {
  type: "message" | "tool";
  id: string;
  data: Message | ToolCall;
}

interface PresenceData {
  opencodeReady: boolean;
  initialPromptSent: boolean;
  prompt: string;
  model: string | null;
  bootstrapSessionId: string | null;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [opencodeReady, setOpencodeReady] = useState(false);
  const [initialPromptSent, setInitialPromptSent] = useState(true); // Assume sent until we know otherwise
  const [projectPrompt, setProjectPrompt] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
   const scrollRef = useRef<HTMLDivElement>(null);
   const eventSourceRef = useRef<EventSource | null>(null);
   const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const loadingHistoryRef = useRef(false);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Load existing session history when opencode is ready
  useEffect(() => {
    if (!opencodeReady || historyLoaded || loadingHistoryRef.current) return;
    
    const loadHistory = async () => {
      loadingHistoryRef.current = true;
      
      try {
        // Get list of sessions
        const sessionsRes = await fetch(`/api/projects/${projectId}/opencode/session`);
        if (!sessionsRes.ok) {
          loadingHistoryRef.current = false;
          setHistoryLoaded(true);
          return;
        }
        
        const sessionsData = await sessionsRes.json();
        const sessions = sessionsData.sessions || sessionsData || [];
        
        if (sessions.length === 0) {
          loadingHistoryRef.current = false;
          setHistoryLoaded(true);
          return;
        }
        
        // Use the most recent session
        const latestSession = sessions[sessions.length - 1];
        const latestSessionId = latestSession.id || latestSession;
        setSessionId(latestSessionId);
        
        // Get messages for this session
        const messagesRes = await fetch(`/api/projects/${projectId}/opencode/session/${latestSessionId}/message`);
        if (!messagesRes.ok) {
          loadingHistoryRef.current = false;
          setHistoryLoaded(true);
          return;
        }
        
        const messagesData = await messagesRes.json();
        // API returns array of { info, parts } objects
        const messages = Array.isArray(messagesData) ? messagesData : (messagesData.messages || []);
        
        // Convert messages to chat items
        const historyItems: ChatItem[] = [];
        
        for (const msg of messages) {
          const info = msg.info || {};
          const parts = msg.parts || [];
          const role = info.role;
          const messageId = info.id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          
          if (role === "user" || role === "assistant") {
            // Extract text content from parts
            let textContent = "";
            
            for (const part of parts) {
              if (part.type === "text" && part.text) {
                textContent += part.text;
              }
              // Handle tool calls in history
              if (part.type === "tool" && part.tool && part.callID) {
                historyItems.push({
                  type: "tool",
                  id: part.callID,
                  data: {
                    id: part.callID,
                    name: part.tool,
                    input: part.state?.input,
                    output: part.state?.output,
                    status: part.state?.status === "completed" ? "success" : 
                            part.state?.status === "error" ? "error" : "success",
                  },
                });
              }
            }
            
            if (textContent) {
              historyItems.push({
                type: "message",
                id: messageId,
                data: {
                  id: messageId,
                  role: role,
                  content: textContent,
                  isStreaming: false,
                },
              });
            }
          }
        }
        
        if (historyItems.length > 0) {
          setItems(historyItems);
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
      
      loadingHistoryRef.current = false;
      setHistoryLoaded(true);
    };
    
    loadHistory();
  }, [projectId, opencodeReady, historyLoaded, scrollToBottom]);

   // Poll for opencode readiness and handle initial prompt
   useEffect(() => {
     if (opencodeReady) return;

     const checkReady = async () => {
       try {
         const viewerId = sessionStorage.getItem(`viewer_${projectId}`) || `chat_${Date.now()}`;
         const response = await fetch(`/api/projects/${projectId}/presence`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ viewerId }),
         });
         if (response.ok) {
           const data = await response.json() as PresenceData;
           if (data.opencodeReady) {
             setOpencodeReady(true);
             setInitialPromptSent(data.initialPromptSent);
             setProjectPrompt(data.prompt);
             // Set session ID from bootstrap session created by queue
             if (data.bootstrapSessionId) {
               setSessionId(data.bootstrapSessionId);
             }
           }
         }
       } catch {
         // Ignore errors
       }
     };

     checkReady();
     pollIntervalRef.current = setInterval(checkReady, 2000);

     return () => {
       if (pollIntervalRef.current) {
         clearInterval(pollIntervalRef.current);
       }
     };
   }, [projectId, opencodeReady]);

   // Load initial prompt message when opencode is ready and prompt hasn't been sent yet
   useEffect(() => {
     if (!opencodeReady || initialPromptSent || !projectPrompt || !sessionId) {
       return;
     }

     // Add user message to UI to show the initial project prompt
     const userMessageId = `user_initial_${Date.now()}`;
     setItems((prev) => [
       ...prev,
       {
         type: "message",
         id: userMessageId,
         data: {
           id: userMessageId,
           role: "user",
           content: projectPrompt,
         },
       },
     ]);
     scrollToBottom();

     // Mark that we've displayed the initial prompt in UI
     setInitialPromptSent(true);
   }, [opencodeReady, initialPromptSent, projectPrompt, sessionId, scrollToBottom]);

  // Connect to event stream
  useEffect(() => {
    if (!opencodeReady) return;

    const eventSource = new EventSource(
      `/api/projects/${projectId}/opencode/event`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("chat.event", (e) => {
      try {
        const event = JSON.parse(e.data);
        handleEvent(event);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.onerror = () => {
      // Reconnect after a delay
      eventSource.close();
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          // Will be handled by the useEffect cleanup/re-run
        }
      }, 2000);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [projectId, opencodeReady]);

  const handleEvent = (event: {
    type: string;
    projectId: string;
    sessionId?: string;
    payload: Record<string, unknown>;
  }) => {
    const { type, payload, sessionId: eventSessionId } = event;

    if (eventSessionId && !sessionId) {
      setSessionId(eventSessionId);
    }

    switch (type) {
      case "chat.message.delta": {
        const { messageId, deltaText } = payload as {
          messageId: string;
          deltaText: string;
        };

        setItems((prev) => {
          const existing = prev.find(
            (item) => item.type === "message" && item.id === messageId
          );

          if (existing) {
            return prev.map((item) =>
              item.id === messageId
                ? {
                    ...item,
                    data: {
                      ...(item.data as Message),
                      content: (item.data as Message).content + deltaText,
                    },
                  }
                : item
            );
          }

          return [
            ...prev,
            {
              type: "message",
              id: messageId,
              data: {
                id: messageId,
                role: "assistant",
                content: deltaText,
                isStreaming: true,
              },
            },
          ];
        });

        setIsStreaming(true);
        scrollToBottom();
        break;
      }

      case "chat.message.final": {
        const { messageId } = payload as { messageId: string };

        setItems((prev) =>
          prev.map((item) =>
            item.id === messageId && item.type === "message"
              ? {
                  ...item,
                  data: { ...(item.data as Message), isStreaming: false },
                }
              : item
          )
        );

        setIsStreaming(false);
        break;
      }

      case "chat.tool.start": {
        const { toolCallId, name, input } = payload as {
          toolCallId: string;
          name: string;
          input: unknown;
        };

        setItems((prev) => [
          ...prev,
          {
            type: "tool",
            id: toolCallId,
            data: {
              id: toolCallId,
              name,
              input,
              status: "running",
            },
          },
        ]);

        scrollToBottom();
        break;
      }

      case "chat.tool.finish": {
        const { toolCallId, output } = payload as {
          toolCallId: string;
          output: unknown;
        };

        setItems((prev) =>
          prev.map((item) =>
            item.id === toolCallId && item.type === "tool"
              ? {
                  ...item,
                  data: {
                    ...(item.data as ToolCall),
                    output,
                    status: "success",
                  },
                }
              : item
          )
        );
        break;
      }

      case "chat.tool.error": {
        const { toolCallId, error } = payload as {
          toolCallId: string;
          error: unknown;
        };

        setItems((prev) =>
          prev.map((item) =>
            item.id === toolCallId && item.type === "tool"
              ? {
                  ...item,
                  data: {
                    ...(item.data as ToolCall),
                    error,
                    status: "error",
                  },
                }
              : item
          )
        );
        break;
      }

      case "chat.session.status": {
        const { status } = payload as { status: string };
        if (status === "completed" || status === "idle") {
          setIsStreaming(false);
        }
        break;
      }
    }
  };

  const handleSend = async (content: string) => {
    // Add user message to UI immediately
    const userMessageId = `user_${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        type: "message",
        id: userMessageId,
        data: {
          id: userMessageId,
          role: "user",
          content,
        },
      },
    ]);
    scrollToBottom();

    // Send to opencode
    try {
      // First, get or create a session
      let currentSessionId = sessionId;

      if (!currentSessionId) {
        const createRes = await fetch(
          `/api/projects/${projectId}/opencode/session`,
          { method: "POST" }
        );
        if (createRes.ok) {
          const data = await createRes.json();
          currentSessionId = data.id;
          setSessionId(currentSessionId);
        }
      }

      if (!currentSessionId) {
        console.error("Failed to get session");
        return;
      }

      // Send message (async - response comes via SSE)
      const res = await fetch(
        `/api/projects/${projectId}/opencode/session/${currentSessionId}/prompt_async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text: content }],
          }),
        }
      );

      // prompt_async returns 204 No Content on success
      if (res.ok || res.status === 204) {
        setIsStreaming(true);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const toggleToolExpanded = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const groupConsecutiveTools = (items: ChatItem[]): (ChatItem | { type: "toolGroup"; id: string; data: ToolCall[] })[] => {
    const grouped: (ChatItem | { type: "toolGroup"; id: string; data: ToolCall[] })[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      
      if (item.type === "tool") {
        // Collect consecutive tool items
        const toolGroup: ToolCall[] = [item.data as ToolCall];
        
        while (i + 1 < items.length && items[i + 1]?.type === "tool") {
          i++;
          const nextItem = items[i];
          if (nextItem) {
            toolGroup.push(nextItem.data as ToolCall);
          }
        }
        
        grouped.push({
          type: "toolGroup",
          id: `group_${toolGroup.map(t => t.id).join('_')}`,
          data: toolGroup,
        });
      } else {
        grouped.push(item);
      }
    }
    
    return grouped;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {opencodeReady ? (
              <p>Send a message to start chatting</p>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p>Waiting for opencode...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {groupConsecutiveTools(items).map((item) =>
              item.type === "message" ? (
                <ChatMessage key={item.id} message={item.data as Message} />
              ) : item.type === "toolGroup" ? (
                <ToolCallGroup
                  key={item.id}
                  toolCalls={item.data as ToolCall[]}
                  expandedTools={expandedTools}
                  onToggle={toggleToolExpanded}
                />
              ) : null
            )}
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={!opencodeReady || isStreaming}
        placeholder={
          !opencodeReady
            ? "Waiting for opencode..."
            : isStreaming
              ? "Processing..."
              : "Type a message..."
        }
      />
    </div>
  );
}
