import { useEffect } from 'react';

export function WindowCleanupComponent() {
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('tick');
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
