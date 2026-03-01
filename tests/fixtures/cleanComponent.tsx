import { useEffect, useState } from 'react';

export function CleanComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setInterval(() => {
      setCount((value) => value + 1);
    }, 1000);

    const handleResize = () => {
      console.log(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => {});
    observer.observe(document.body);

    fetch('/api/data', { signal: controller.signal }).catch(() => {});

    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return <div>{count}</div>;
}
