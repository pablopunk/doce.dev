"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteProjectDialog({
  projectId,
  projectName,
  isOpen,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteProjectDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm(projectId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Project
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete <strong>{projectName}</strong>, including:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
          <li>Docker container and volumes</li>
          <li>All project files and directories</li>
          <li>Database record</li>
        </ul>

        {error && (
          <div className="rounded-md p-3 text-sm bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            variant="destructive"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Project"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
