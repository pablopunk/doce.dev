import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { MacOSWindow } from "./components/MacOSWindow";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Dashboard } from "./scenes/Scene2Dashboard";
import { Scene3Chat } from "./scenes/Scene3Chat";
import { Scene5Deploy } from "./scenes/Scene5Deploy";
import { Scene6iPhone } from "./scenes/Scene6iPhone";
import { Scene7Logo } from "./scenes/Scene7Logo";

const TRANSITION_FRAMES = 10;
const WINDOW_WIDTH = 1720;
const WINDOW_HEIGHT = 960;

export const DoceShowcase: React.FC = () => {
	return (
		<AbsoluteFill
			style={{
				background:
					"radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0c0c1a 40%, #080812 100%)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "15%",
					left: "10%",
					width: 500,
					height: 500,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(99,70,220,0.12) 0%, transparent 70%)",
					filter: "blur(60px)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: "10%",
					right: "15%",
					width: 400,
					height: 400,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
					filter: "blur(50px)",
				}}
			/>

			<MacOSWindow width={WINDOW_WIDTH} height={WINDOW_HEIGHT}>
				<TransitionSeries>
					<TransitionSeries.Sequence durationInFrames={75}>
						<Scene1Hook />
					</TransitionSeries.Sequence>

					<TransitionSeries.Transition
						presentation={fade()}
						timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
					/>

					<TransitionSeries.Sequence durationInFrames={135}>
						<Scene2Dashboard />
					</TransitionSeries.Sequence>

					<TransitionSeries.Transition
						presentation={fade()}
						timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
					/>

					<TransitionSeries.Sequence durationInFrames={185}>
						<Scene3Chat />
					</TransitionSeries.Sequence>

					<TransitionSeries.Transition
						presentation={fade()}
						timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
					/>

					<TransitionSeries.Sequence durationInFrames={60}>
						<Scene5Deploy />
					</TransitionSeries.Sequence>

					<TransitionSeries.Transition
						presentation={fade()}
						timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
					/>

					<TransitionSeries.Sequence durationInFrames={100}>
						<Scene6iPhone />
					</TransitionSeries.Sequence>

					<TransitionSeries.Transition
						presentation={fade()}
						timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
					/>

					<TransitionSeries.Sequence durationInFrames={110}>
						<Scene7Logo />
					</TransitionSeries.Sequence>
				</TransitionSeries>
			</MacOSWindow>
		</AbsoluteFill>
	);
};
