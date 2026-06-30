import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="card-surface max-w-md w-full p-8 text-center">
            <h1 className="page-title mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              An unexpected error occurred. Reload the page to try again.
            </p>
            <button type="button" onClick={this.handleReload} className="btn-primary btn-md mt-6">
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
