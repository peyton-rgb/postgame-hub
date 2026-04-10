'use client'
import { useEffect, useState } from 'react'

export default function PostgameLoader({ onFinish }) {
  const [phase, setPhase] = useState('tracing')

  useEffect(() => {
    const fillTimer = setTimeout(() => setPhase('filled'), 2600)
    const doneTimer = setTimeout(() => {
      setPhase('gone')
      onFinish?.()
    }, 3600)
    return () => {
      clearTimeout(fillTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  if (phase === 'gone') return null

  return (
    <div className={`pg-loader ${phase === 'filled' ? 'pg-fading' : ''}`}>
      <div className="pg-loader-wrap">
        <svg viewBox="0 0 200 200">
          <circle className="fill-circle" cx="100" cy="100" r="86" />
          <path className="fill-plus" d="M88 58h24v30h30v24h-30v30h-24v-30h-30v-24h30z" />
          <circle className="thin-orange" cx="100" cy="100" r="86" />
          <path className="thin-white" d="M88 58h24v30h30v24h-30v30h-24v-30h-30v-24h30z" />
          <circle className="glow-orange" cx="100" cy="100" r="86" />
          <path className="glow-white" d="M88 58h24v30h30v24h-30v30h-24v-30h-30v-24h30z" />
        </svg>
      </div>
      <style jsx>{`
        .pg-loader {
          position: fixed;
          inset: 0;
          background: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: 1;
          transition: opacity 0.8s ease;
        }
        .pg-loader.pg-fading { opacity: 0; }
        .pg-loader-wrap { width: 200px; height: 200px; }
        .pg-loader-wrap svg { width: 100%; height: 100%; overflow: visible; }
        .thin-orange { fill: none; stroke: #D73F09; stroke-width: 1.5; opacity: 0.18; }
        .thin-white { fill: none; stroke: #fff; stroke-width: 1.5; opacity: 0.18; }
        .glow-orange {
          fill: none;
          stroke: #D73F09;
          stroke-width: 2.25;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 3px rgba(215, 63, 9, 0.8)) drop-shadow(0 0 7px rgba(215, 63, 9, 0.5));
          stroke-dasharray: 560;
          stroke-dashoffset: 560;
          animation: traceO 2.6s ease-in-out forwards;
        }
        .glow-white {
          fill: none;
          stroke: #fff;
          stroke-width: 2.25;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 2.5px rgba(255, 255, 255, 0.75)) drop-shadow(0 0 6px rgba(255, 255, 255, 0.4));
          stroke-dasharray: 470;
          stroke-dashoffset: 470;
          animation: traceW 2.6s ease-in-out 0.35s forwards;
        }
        .fill-circle {
          fill: #D73F09;
          opacity: 0;
          filter: drop-shadow(0 0 18px rgba(215, 63, 9, 0.55));
          animation: fillIn 0.5s ease-out 2.6s forwards;
        }
        .fill-plus {
          fill: #fff;
          opacity: 0;
          animation: fillIn 0.5s ease-out 2.6s forwards;
        }
        @keyframes traceO { to { stroke-dashoffset: 0; } }
        @keyframes traceW { to { stroke-dashoffset: 0; } }
        @keyframes fillIn { to { opacity: 1; } }
      `}</style>
    </div>
  )
}