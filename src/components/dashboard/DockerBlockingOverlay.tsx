import { Button } from "@/components/ui/button";

export function DockerBlockingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-background p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Docker is unavailable</h2>
          <p className="text-sm text-muted-foreground">
            Please start Docker to continue.
          </p>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          Refresh Page
        </Button>
      </div>
    </div>
  );
}
