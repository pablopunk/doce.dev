import { Img, staticFile } from "remotion";

interface LogoProps {
	size?: number;
}

/**
 * Real doce.dev logo (the "E" mark from /public/icon-1080.svg).
 * Mirrors the Navbar's <img src="/icon-1080.svg" className="w-5 h-5" />.
 */
export const Logo: React.FC<LogoProps> = ({ size = 20 }) => (
	<Img
		src={staticFile("icon-1080.svg")}
		alt="doce.dev"
		style={{ width: size, height: size, objectFit: "contain" }}
	/>
);
