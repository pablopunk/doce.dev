import "./index.css";
import { Composition } from "remotion";
import { DoceShowcase } from "./DoceShowcase";

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="DoceShowcase"
				component={DoceShowcase}
				durationInFrames={615}
				fps={30}
				width={1920}
				height={1080}
			/>
		</>
	);
};
