import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {SandboxPreview} from './windows/SandboxPreview.tsx';
import './index.css';

function RootRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState(null, '', to);
      setPathname(to);
    }
  };

  if (pathname === '/map' || pathname.startsWith('/map/')) {
    return <App />;
  }

  return <SandboxPreview onOpenMap={() => navigate('/map')} />;
}

createRoot(document.getElementById('root')!).render(<RootRouter />);
