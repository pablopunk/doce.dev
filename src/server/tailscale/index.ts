export { tailscaleDown, tailscaleUp } from "./auth";
export { injectTailscaleSidecar, removeTailscaleSidecar } from "./compose";
export type { TailscaleConfig } from "./config";
export { getTailscaleConfig, setTailscaleConfig } from "./config";
export {
	isTailscaleInstalled,
	startTailscaled,
	stopTailscaled,
} from "./daemon";
export { getServeStatus, registerServe, unregisterServe } from "./serve";
export type { TailscaleStatus } from "./status";
export { getTailscaleStatus } from "./status";
export {
	getTailscaleAppUrl,
	getTailscaleProjectUrl,
	invalidateTailscaleUrlCache,
} from "./urls";
