import { useState, useEffect, useRef, useCallback } from "react";

interface PresenceData {
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	prompt: string;
	model: string | null;
	bootstrapSessionId: string | null;
}

interface UseChatSessionOptions {
	projectId: string;
	opencodeReady: boolean;
	onSessionIdChange?: (sessionId: string | null) => void;
}

interface UseChatSessionResult {
	sessionId: string | null;
	presenceLoaded: boolean;
	opencodeReady: boolean;
	initialPromptSent: boolean;
	userPromptMessageId: string | null;
	projectPrompt: string | null;
	currentModel: string | null;
	setOpencodeReady: (ready: boolean) => void;
	setInitialPromptSent: (sent: boolean) => void;
	setUserPromptMessageId: (id: string | null) => void;
	setProjectPrompt: (prompt: string | null) => void;
	setCurrentModel: (model: string | null) => void;
	setSessionId: (id: string | null) => void;
}

export function useChatSession({
	projectId,
	opencodeReady: initialOpencodeReady,
	onSessionIdChange,
}: UseChatSessionOptions): UseChatSessionResult {
	const [sessionId, setSessionIdState] = useState<string | null>(null);
	const [opencodeReady, setOpencodeReady] = useState(initialOpencodeReady);
	const [initialPromptSent, setInitialPromptSent] = useState(true);
	const [userPromptMessageId, setUserPromptMessageId] = useState<string | null>(
		null,
	);
	const [projectPrompt, setProjectPrompt] = useState<string | null>(null);
	const [currentModel, setCurrentModel] = useState<string | null>(null);
	const [presenceLoaded, setPresenceLoaded] = useState(false);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const setSessionId = useCallback(
		(id: string | null) => {
			setSessionIdState(id);
			onSessionIdChange?.(id ?? null);
		},
		[onSessionIdChange],
	);

	useEffect(() => {
		if (opencodeReady) return;

		const checkReady = async () => {
			try {
				const viewerId =
					sessionStorage.getItem(`viewer_${projectId}`) || `chat_${Date.now()}`;
				const response = await fetch(`/api/projects/${projectId}/presence`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ viewerId }),
				});
				if (response.ok) {
					const data = (await response.json()) as PresenceData;
					if (data.opencodeReady) {
						setOpencodeReady(true);
						setInitialPromptSent(data.initialPromptSent);
						setUserPromptMessageId(data.userPromptMessageId);
						setProjectPrompt(data.prompt);
						setCurrentModel(data.model);
						if (data.bootstrapSessionId) {
							setSessionId(data.bootstrapSessionId);
						}
						setPresenceLoaded(true);
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
	}, [projectId, opencodeReady, setSessionId]);

	return {
		sessionId,
		presenceLoaded,
		opencodeReady,
		initialPromptSent,
		userPromptMessageId,
		projectPrompt,
		currentModel,
		setOpencodeReady,
		setInitialPromptSent,
		setUserPromptMessageId,
		setProjectPrompt,
		setCurrentModel,
		setSessionId,
	};
}
