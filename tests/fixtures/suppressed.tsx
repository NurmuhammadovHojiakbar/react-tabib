// react-tabib-ignore-file
import { useEffect } from 'react';

export function Suppressed() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(timer);
    }, 1000);
  });

  return null;
}
