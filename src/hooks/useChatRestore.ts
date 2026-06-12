import { actions } from "astro:actions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { PromptAttachmentPart } from "@/types/message";

interface UseChatRestoreOptions<TItem> {
	projectId: string;
	sessionId: string | null;
	items: TItem[];
	revertMessageId: string | null;
	setRevertMessageId: (messageId: string | null) => void;
	showRequestError: (title: string, error: unknown) => void;
}

export function useChatRestore<TItem extends { type: string; id: string }>({
	projectId,
	sessionId,
	items,
	revertMessageId,
	setRevertMessageId,
	showRequestError,
}: UseChatRestoreOptions<TItem>) {
	const [restoreEnabled, setRestoreEnabled] = useState<boolean>(true);
	const [restoreGuardLoaded, setRestoreGuardLoaded] = useState(false);
	const [draftSeed, setDraftSeed] = useState<{
		key: number;
		text: string;
		attachments: PromptAttachmentPart[];
	} | null>(null);

	// Fetch restore safety status when session is available
	useEffect(() => {
		if (!sessionId) {
			setRestoreEnabled(false);
			setRestoreGuardLoaded(true);
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const result = await actions.chat.getRestoreStatus({ projectId });
				if (cancelled) return;
				if (result.error) {
					setRestoreEnabled(false);
				} else {
					setRestoreEnabled(result.data?.canRestore ?? false);
				}
			} catch (_error) {
				if (cancelled) return;
				setRestoreEnabled(false);
			} finally {
				if (!cancelled) setRestoreGuardLoaded(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId, projectId]);

	const handleRestore = useCallback(
		async ({
			messageId,
			role,
			text,
			attachments,
		}: {
			messageId: string;
			role: "user" | "assistant";
			text: string;
			attachments: PromptAttachmentPart[];
		}) => {
			// Optimistic: snapshot prev state, apply, roll back on failure.
			const prevRevert = revertMessageId;
			setRevertMessageId(messageId);
			if (role === "user") {
				setDraftSeed({ key: Date.now(), text, attachments });
			}
			try {
				const result = await actions.chat.revertToMessage({
					projectId,
					messageId,
				});
				if (result.error) {
					throw new Error(result.error.message);
				}
				// Trust server-returned revert pointer.
				const serverId = result.data?.revertMessageId ?? messageId;
				if (serverId !== messageId) setRevertMessageId(serverId);
				toast.success("Conversation restored");
			} catch (error) {
				setRevertMessageId(prevRevert);
				if (role === "user") setDraftSeed(null);
				showRequestError("Failed to restore conversation", error);
				throw error;
			}
		},
		[projectId, revertMessageId, setRevertMessageId, showRequestError],
	);

	const handleUnrevert = useCallback(async () => {
		const prevRevert = revertMessageId;
		if (!prevRevert) return;
		setRevertMessageId(null);
		try {
			const result = await actions.chat.unrevertSession({ projectId });
			if (result.error) throw new Error(result.error.message);
		} catch (error) {
			setRevertMessageId(prevRevert);
			showRequestError("Failed to cancel restore", error);
			throw error;
		}
	}, [projectId, revertMessageId, setRevertMessageId, showRequestError]);

	const clearDraftSeed = useCallback(() => setDraftSeed(null), []);

	const visibleItems = useMemo(() => {
		if (!revertMessageId) return items;
		const boundary = items.findIndex(
			(item) => item.type === "message" && item.id === revertMessageId,
		);
		if (boundary < 0) return items;
		return items.slice(0, boundary);
	}, [items, revertMessageId]);

	return {
		restoreEnabled,
		restoreGuardLoaded,
		draftSeed,
		handleRestore,
		handleUnrevert,
		clearDraftSeed,
		visibleItems,
	};
}
