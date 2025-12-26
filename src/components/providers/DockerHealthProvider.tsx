"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface DockerHealthContextType {
  dockerAvailable: boolean;
  error: string | null;
}

const DockerHealthContext = createContext<DockerHealthContextType | undefined>(undefined);

export function DockerHealthProvider({ children }: { children: ReactNode }) {
  const [dockerAvailable, setDockerAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check Docker health once on mount
    const checkDocker = async () => {
      try {
        const response = await fetch("/api/health/docker", {
          method: "GET",
        });

        if (!response.ok) {
          setDockerAvailable(false);
          setError("Docker is unavailable");
          return;
        }

        const data = (await response.json()) as { ok: boolean };
        
        if (!data.ok) {
          setDockerAvailable(false);
          setError("Docker is unavailable");
        } else {
          setDockerAvailable(true);
          setError(null);
        }
      } catch (err) {
        // If health check itself fails, assume Docker is available
        // This is a fail-open strategy to avoid blocking on network errors
        setDockerAvailable(true);
        setError(null);
      }
    };

    checkDocker();
  }, []);

  return (
    <DockerHealthContext.Provider value={{ dockerAvailable, error }}>
      {children}
    </DockerHealthContext.Provider>
  );
}

export function useDocker() {
  const context = useContext(DockerHealthContext);
  // Return default context if not yet initialized (e.g., during SSR or before hydration)
  if (context === undefined) {
    return {
      dockerAvailable: true,
      error: null,
    };
  }
  return context;
}
