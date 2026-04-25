import React, { useEffect, useRef } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CONFIG = {
  particleCount: 86,
  trailSpan: 0.28,
  durationMs: 7800,
  pulseDurationMs: 6800,
  strokeWidth: 4.3,
  searchTurns: 4.0,
  searchBaseRadius: 8.0,
  searchRadiusAmp: 8.5,
  searchPulse: 2.4,
  searchScale: 1.00,
};

const PIPELINE_STEPS = [
  'Processing input data...',
  'Analyzing context...',
  'Checking threat patterns...',
  'Generating intelligence report...',
];

function spiralPoint(progress, detailScale) {
  const t = progress * Math.PI * 2;
  const angle = t * CONFIG.searchTurns;
  const radius =
    CONFIG.searchBaseRadius +
    (1 - Math.cos(t)) * (CONFIG.searchRadiusAmp + detailScale * CONFIG.searchPulse);
  return {
    x: 50 + Math.cos(angle) * radius * CONFIG.searchScale,
    y: 50 + Math.sin(angle) * radius * CONFIG.searchScale,
  };
}

function normalizeProgress(p) {
  return ((p % 1) + 1) % 1;
}

function getDetailScale(time) {
  const pulseProgress = (time % CONFIG.pulseDurationMs) / CONFIG.pulseDurationMs;
  return 0.52 + ((Math.sin(pulseProgress * Math.PI * 2 + 0.55) + 1) / 2) * 0.48;
}

function buildPath(detailScale, steps = 480) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = spiralPoint(i / steps, detailScale);
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(' ');
}

export function SpiralLoader({ label = 'Scanning for threats…' }) {
  // Separate refs: one for the path element, one for the particles group
  const pathRef = useRef(null);
  const particlesRef = useRef(null); // dedicated <g> for circles — React never touches it
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const stepRef = useRef(null);
  const stepIdxRef = useRef(0);

  useEffect(() => {
    const pathEl = pathRef.current;
    const particleG = particlesRef.current;
    if (!pathEl || !particleG) return;

    // Build particle circles inside the dedicated group
    const circles = Array.from({ length: CONFIG.particleCount }, () => {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('fill', 'currentColor');
      particleG.appendChild(c);
      return c;
    });

    startRef.current = performance.now();

    const stepInterval = setInterval(() => {
      stepIdxRef.current = (stepIdxRef.current + 1) % PIPELINE_STEPS.length;
      if (stepRef.current) {
        stepRef.current.textContent = PIPELINE_STEPS[stepIdxRef.current];
      }
    }, 900);

    function render(now) {
      const time = now - startRef.current;
      const progress = (time % CONFIG.durationMs) / CONFIG.durationMs;
      const detailScale = getDetailScale(time);

      pathEl.setAttribute('d', buildPath(detailScale));

      circles.forEach((node, index) => {
        const tailOffset = index / (CONFIG.particleCount - 1);
        const p = spiralPoint(
          normalizeProgress(progress - tailOffset * CONFIG.trailSpan),
          detailScale,
        );
        const fade = Math.pow(1 - tailOffset, 0.56);
        node.setAttribute('cx', p.x.toFixed(2));
        node.setAttribute('cy', p.y.toFixed(2));
        node.setAttribute('r', (0.9 + fade * 2.7).toFixed(2));
        node.setAttribute('opacity', (0.04 + fade * 0.96).toFixed(3));
      });

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(stepInterval);
      circles.forEach(c => c.remove());
    };
  }, []);

  return (
    <div
      className="animate-fade-in"
      style={{ display: 'grid', gap: '20px', justifyItems: 'center', padding: '32px 16px' }}
    >
      {/* SVG — path is a React element; particles group is imperative-only */}
      <div style={{ width: 'min(72vmin, 420px)', aspectRatio: '1', display: 'grid', placeItems: 'center' }}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
          style={{ width: '100%', height: '100%', overflow: 'visible', color: '#60a5fa' }}
        >
          {/* Ghost path — React-managed, opacity only */}
          <path
            ref={pathRef}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={CONFIG.strokeWidth}
            opacity="0.10"
          />
          {/* Particle group — imperatively managed, React never re-renders children */}
          <g ref={particlesRef} />
        </svg>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', display: 'grid', gap: '4px' }}>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          {label}
        </p>
      </div>

      {/* Cycling pipeline step */}
      <p
        ref={stepRef}
        style={{ fontSize: '13px', color: '#94a3b8', margin: 0, minHeight: '20px' }}
      >
        {PIPELINE_STEPS[0]}
      </p>
    </div>
  );
}
