import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <div className="max-w-3xl mx-auto bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-200 px-5 py-3">
              <h2 className="text-base font-semibold text-rose-700">Error en la interfaz</h2>
              <p className="text-sm text-rose-600 mt-0.5">La página crasheó al renderizar. Detalle abajo:</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Mensaje</p>
                <pre className="text-sm text-slate-800 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
              </div>
              {this.state.error?.stack && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Stack</p>
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">{this.state.error.stack}</pre>
                </div>
              )}
              {this.state.info?.componentStack && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Componentes</p>
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48">{this.state.info.componentStack}</pre>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={this.reset} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Reintentar</button>
                <button onClick={() => (window.location.href = '/dashboard')} className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Volver al dashboard</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
