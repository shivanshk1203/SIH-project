import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "16px",
          margin: "12px",
          background: "rgba(30, 41, 59, 0.9)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "8px",
          color: "#f87171",
          fontSize: "0.85rem",
          zIndex: 1000
        }}>
          <h4 style={{ margin: "0 0 6px 0", color: "#fca5a5", fontSize: "14px", fontWeight: 700 }}>
            {this.props.fallbackTitle || "Unable to load one section"}
          </h4>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "12px" }}>
            An unexpected error occurred in this component. The remaining intelligence and map tools remain active.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "8px",
              padding: "4px 10px",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              color: "#fca5a5",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem"
            }}
          >
            Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
