'use client'
import { useState } from 'react'
import PostgameLoader from './PostgameLoader'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const [loaderDone, setLoaderDone] = useState(false)

  return (
    <>
      {!loaderDone && <PostgameLoader onFinish={() => setLoaderDone(true)} />}
      <div
        style={{
          opacity: loaderDone ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        {children}
      </div>
    </>
  )
}
