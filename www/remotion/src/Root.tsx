import "./index.css";
import { Composition } from "remotion";
import { DoceShowcase } from "./DoceShowcase";
import type { ThemeMode } from "./theme";

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="DoceShowcaseDark"
				component={DoceShowcase}
				defaultProps={{ mode: "dark" as ThemeMode }}
				durationInFrames={615}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="DoceShowcaseLight"
				component={DoceShowcase}
				defaultProps={{ mode: "light" as ThemeMode }}
				durationInFrames={615}
				fps={30}
				width={1920}
				height={1080}
			/>
		</>
	);
};
