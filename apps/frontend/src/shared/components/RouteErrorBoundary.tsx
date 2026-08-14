import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, RotateCcw } from 'lucide-react';

type Props = {
  children: ReactNode;
  locationKey?: string;
};

type State = {
  error: Error | null;
  locationKey: string;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, locationKey: '' };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    const nextKey = props.locationKey ?? '';
    if (state.error && nextKey !== state.locationKey) {
      return { error: null, locationKey: nextKey };
    }

    if (nextKey !== state.locationKey) {
      return { locationKey: nextKey };
    }

    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign('/teams');
  };

  private goHome = () => {
    window.location.assign('/teams');
  };

  render() {
    if (this.state.error) {
      return (
        <section className="route-error-state">
          <AlertTriangle size={28} />
          <h1>页面暂时无法显示</h1>
          <p>前端渲染时遇到异常，请刷新页面或返回上一页重试。</p>
          <div className="route-error-actions">
            <button type="button" className="icon-only" onClick={this.retry} aria-label="重试渲染" title="重试渲染">
              <RotateCcw size={16} />
            </button>
            <button type="button" className="secondary icon-only" onClick={this.goBack} aria-label="返回上一页" title="返回上一页">
              <ArrowLeft size={16} />
            </button>
            <button type="button" className="secondary icon-only" onClick={this.goHome} aria-label="回到队伍大厅" title="回到队伍大厅">
              <Home size={16} />
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export function RouteErrorBoundaryWithLocation({ children }: Props) {
  const location = useLocation();
  return <RouteErrorBoundary locationKey={`${location.pathname}${location.search}`}>{children}</RouteErrorBoundary>;
}
