
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL APP ERROR:', error, errorInfo);
  }

  private handleHardReset = () => {
    try {
        console.log('Clearing storage and resetting...');
        localStorage.clear();
        sessionStorage.clear();
        // Clear cookies if possible
        document.cookie.split(";").forEach((c) => { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        window.location.reload();
    } catch (e) {
        console.error("Reset failed", e);
        window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-900/30 p-4 rounded-full mb-4 animate-pulse">
             <AlertTriangle size={48} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-black mb-2 tracking-tighter">APP CRASHED</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
            {this.state.error?.message || 'A critical system error prevented startup.'}
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
                onClick={() => window.location.reload()}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
                <RefreshCw size={18} /> Try Reloading
            </button>
            
            <button
                onClick={this.handleHardReset}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
                <Trash2 size={18} /> Clear Cache & Restart
            </button>
          </div>
          <div className="mt-8 text-[10px] text-gray-600 font-mono">
            Error Boundary v2.1 • React 18
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
