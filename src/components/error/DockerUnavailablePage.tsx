export function DockerUnavailablePage() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-background">
			<div className="flex flex-col items-center justify-center gap-6 text-center max-w-md px-4">
				<div>
					<h1 className="text-3xl font-bold mb-2">503 Service Unavailable</h1>
					<p className="text-muted-foreground">
						Docker is unavailable. Please start Docker and refresh the page.
					</p>
				</div>

				<button
					type="button"
					onClick={() => window.location.reload()}
					className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
				>
					Refresh Page
				</button>
			</div>
		</div>
	);
}
