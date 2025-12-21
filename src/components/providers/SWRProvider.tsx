import { SWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import type { ReactNode } from "react";

interface SWRProviderProps {
	children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
	return (
		<SWRConfig
			value={{
				fetcher,
				revalidateOnFocus: true,
				revalidateOnReconnect: true,
				dedupingInterval: 2000,
				focusThrottleInterval: 5000,
				errorRetryCount: 3,
				errorRetryInterval: 5000,
			}}
		>
			{children}
		</SWRConfig>
	);
}
