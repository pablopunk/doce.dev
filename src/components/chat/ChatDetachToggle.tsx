import { Maximize2, Minimize2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatLayout } from "@/stores/useChatLayout";

export function ChatDetachToggle() {
	const { isDetached, toggle } = useChatLayout();

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-muted-foreground hover:text-foreground"
						onClick={toggle}
					/>
				}
			>
				<motion.div
					initial={false}
					animate={{ rotate: isDetached ? 180 : 0 }}
					transition={{ type: "spring", stiffness: 300, damping: 25 }}
				>
					{isDetached ? (
						<Maximize2 className="h-3.5 w-3.5" />
					) : (
						<Minimize2 className="h-3.5 w-3.5" />
					)}
				</motion.div>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{isDetached ? "Dock chat" : "Detach chat"}
			</TooltipContent>
		</Tooltip>
	);
}
