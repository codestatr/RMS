import React, { useEffect, useState } from 'react'

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <time className="live-clock" dateTime={now.toISOString()} title={now.toLocaleDateString()}>
    {now.toLocaleTimeString()}
  </time>
}
