interface AIBlobProps {
	size?: number;
	className?: string;
}

export default function AIBlob({ size = 120, className = "" }: AIBlobProps) {
	return (
		<div
			className={`relative ${className}`}
			style={{ width: size, height: size }}
		>
			{/* Outer glow ring */}
			<div
				className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 blur-xl opacity-60"
				style={{
					transform: "scale(1.2)",
				}}
			/>

			{/* Main blob */}
			<div
				className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-2xl"
				style={{
					animation: "blob-idle 4s ease-in-out infinite",
				}}
			/>

			{/* Inline keyframes */}
			<style jsx>{`
        @keyframes blob-idle {
          0%, 100% {
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
          }
          50% {
            border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
          }
        }
      `}</style>
		</div>
	);
}
