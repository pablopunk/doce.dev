import { useCallback, useEffect, useRef, useState } from "react";

export function useChatScroll(items: ReadonlyArray<unknown>) {
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	const isNearBottom = useCallback(() => {
		if (!scrollRef.current) return false;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		return scrollHeight - (scrollTop + clientHeight) < 100;
	}, []);

	const scrollToBottom = useCallback(() => {
		if (scrollRef.current && shouldAutoScroll) {
			setTimeout(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
				}
			}, 0);
		}
	}, [shouldAutoScroll]);

	const handleScroll = useCallback(() => {
		setShouldAutoScroll(isNearBottom());
	}, [isNearBottom]);

	useEffect(() => {
		if (items.length > 0 && shouldAutoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [shouldAutoScroll, items]);

	return {
		scrollRef,
		shouldAutoScroll,
		isNearBottom,
		scrollToBottom,
		handleScroll,
	};
}
