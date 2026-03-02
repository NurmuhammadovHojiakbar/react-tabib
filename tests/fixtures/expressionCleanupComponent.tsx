import { useEffect, useLayoutEffect, useState } from 'react';

// All three cleanup patterns should produce ZERO findings.

export function ExpressionBodyCleanup() {
  useEffect(() => {
    const timer = setInterval(() => {}, 1000);
    // expression-body arrow function — the root cause of false positives
    return () => clearInterval(timer);
  }, []);

  return null;
}

export function NamedCleanupVar() {
  useEffect(() => {
    const observer = new ResizeObserver(() => {});
    observer.observe(document.body);
    // named variable returned as cleanup
    const cleanup = () => {
      observer.disconnect();
    };
    return cleanup;
  }, []);

  return null;
}

export function WindowTimerCleanup() {
  useEffect(() => {
    const timer = window.setInterval(() => {}, 500);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

export function LayoutEffectCleanup() {
  useLayoutEffect(() => {
    const handler = () => {};
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
    };
  }, []);

  return null;
}

export function FetchWithAbortNoFlag() {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/data', { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => setData(payload.value));
    return () => controller.abort();
  }, []);

  return <div>{data}</div>;
}
