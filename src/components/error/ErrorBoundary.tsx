"use client";

import React from "react";

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: (error: Error, retry: () => void) => React.ReactNode;
	componentName?: string;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary component to catch errors in child components
 * and display a fallback UI instead of crashing the entire page.
 */
export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return {
			hasError: true,
			error,
			errorInfo: null,
		};
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.setState({ errorInfo });

		// Log error to console (client-side only)
		console.error(
			`React component error caught by ErrorBoundary ${this.props.componentName ? `(${this.props.componentName})` : ""}:`,
			{
				error: error.message,
				stack: error.stack,
				componentStack: errorInfo.componentStack,
			},
		);

		// Also send to server for monitoring
		void fetch("/api/errors/log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				error: error.message,
				stack: error.stack,
				componentStack: errorInfo.componentStack,
				componentName: this.props.componentName,
			}),
		}).catch(() => {
			// Silently fail if error logging fails
		});

		// Call optional error handler
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}
	}

	private handleRetry = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	override render() {
		if (this.state.hasError && this.state.error) {
			// Custom fallback provided
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.handleRetry);
			}

			// Default fallback UI
			return (
				<div className="flex items-center justify-center min-h-[200px] p-4">
					<div className="rounded-lg border border-error bg-error/5 p-4 max-w-md">
						<h2 className="font-semibold text-error mb-2">
							Something went wrong
						</h2>
						<details className="text-sm text-muted-foreground mb-4">
							<summary className="cursor-pointer font-medium">
								Error details
							</summary>
							<pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-[200px]">
								{this.state.error.message}
								{this.state.errorInfo &&
									`\n\n${this.state.errorInfo.componentStack}`}
							</pre>
						</details>
						<button
							type="button"
							onClick={this.handleRetry}
							className="w-full px-3 py-2 rounded bg-error/10 text-error hover:bg-error/20 font-medium transition-colors"
						>
							Try Again
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
