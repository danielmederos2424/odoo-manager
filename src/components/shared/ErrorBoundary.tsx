// src/components/shared/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../../services/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and handle React rendering errors
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to our logging service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    try {
      logError('React Error Boundary caught an error', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    } catch (loggingError) {
      console.error('Failed to log error to logging service:', loggingError);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI if provided, otherwise a simple error message
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          backgroundColor: 'rgba(255,0,0,0.05)',
          border: '1px solid rgba(255,0,0,0.2)',
          borderRadius: '8px'
        }}>
          <h3>Something went wrong</h3>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Show error details</summary>
            <p>{this.state.error?.message}</p>
            <p>{this.state.error?.stack}</p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;