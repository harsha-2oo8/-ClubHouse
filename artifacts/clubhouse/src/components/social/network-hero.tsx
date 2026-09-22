import { useEffect, useRef } from "react";

type NodeKind = "student" | "project" | "club" | "event";

const KIND_COLOR: Record<NodeKind, string> = {
  student: "#22d3ee",
  project: "#a78bfa",
  club: "#fb7185",
  event: "#fbbf24",
};

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: NodeKind;
}

/**
 * ClubHouse network hero: typed nodes (students ↔ projects ↔ clubs ↔ events)
 * drift slowly and draw connection paths when near. Concept-first, cheap:
 * transform-free 2D canvas, capped node count, pauses offscreen, and renders
 * a single static frame when the OS requests reduced motion.
 */
export function NetworkHero({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kinds: NodeKind[] = ["student", "project", "club", "event"];
    let nodes: Node[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(46, Math.max(22, Math.floor((w * h) / 26000)));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: [2.2, 3.4, 4.6, 3][i % 4],
        kind: kinds[i % kinds.length],
      }));
    };

    const LINK = 130;

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -8) n.x = w + 8;
        if (n.x > w + 8) n.x = -8;
        if (n.y < -8) n.y = h + 8;
        if (n.y > h + 8) n.y = -8;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.strokeStyle =
              a.kind === b.kind ? `${KIND_COLOR[a.kind]}22` : "#a78bfa30";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = KIND_COLOR[n.kind];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !running && !reduced) {
          running = true;
          raf = requestAnimationFrame(frame);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 },
    );

    resize();
    window.addEventListener("resize", resize);
    observer.observe(canvas);
    if (reduced) {
      // One static frame: composition without motion.
      running = false;
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        ctx.fillStyle = KIND_COLOR[n.kind];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
    />
  );
}
