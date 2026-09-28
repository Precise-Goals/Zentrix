import { useEffect, useRef } from 'react';
import { Application } from '@splinetool/runtime';

export default function ThreeD() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Guard against environments or browsers where WebGL is unsupported or disabled
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        return;
      }
    } catch {
      return;
    }

    let splineApp: Application | null = null;
    try {
      splineApp = new Application(canvasRef.current);
      splineApp.load('/carex.splinecode').catch(() => {});
    } catch {
      // Spline runtime initialization fallback
    }

    return () => {
      try {
        splineApp?.dispose();
      } catch {}
    };
  }, []);

  return (
    <div className='dmodel' style={{ width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
