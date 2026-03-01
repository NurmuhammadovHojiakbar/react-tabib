import { useEffect, useState } from 'react';

export function LeakyComponent() {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('tick');
    }, 1000);

    window.addEventListener('resize', handleResize);
    const socket = new WebSocket('wss://example.com');
    const observer = new ResizeObserver(() => {});

    fetch('/api/data')
      .then((response) => response.json())
      .then((payload) => setData(payload.value));

    socket.addEventListener('message', () => {
      console.log(timer);
    });

    observer.observe(document.body);
  });

  function handleResize() {
    console.log('resize');
  }

  return <div>{data}</div>;
}
