import { useEffect, useState } from "react";

interface Butterfly {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  color: string;
}

const colors = ["#38e9ff", "#4ff7c8", "#7c8cff", "#b26cff", "#6ff5af"];

export const ButterflyCursor = () => {
  const [butterflies, setButterflies] = useState<Butterfly[]>([]);

  useEffect(() => {
    let nextId = 0;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const burst = Array.from({ length: 7 }, (_, index) => {
        const angle = (-110 + index * 36 + Math.random() * 18) * Math.PI / 180;
        const distance = 42 + Math.random() * 34;
        return {
          id: nextId++,
          x: event.clientX,
          y: event.clientY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - 24,
          rotate: -34 + Math.random() * 68,
          scale: 0.72 + Math.random() * 0.45,
          color: colors[index % colors.length],
        };
      });

      setButterflies(current => [...current, ...burst].slice(-35));
      window.setTimeout(() => {
        const ids = new Set(burst.map(item => item.id));
        setButterflies(current => current.filter(item => !ids.has(item.id)));
      }, 1150);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {butterflies.map(item => (
        <span
          key={item.id}
          className="butterfly-pop"
          style={{
            left: item.x,
            top: item.y,
            ["--dx" as string]: `${item.dx}px`,
            ["--dy" as string]: `${item.dy}px`,
            ["--rotate" as string]: `${item.rotate}deg`,
            ["--scale" as string]: item.scale,
            ["--wing" as string]: item.color,
          }}
        >
          <svg viewBox="0 0 32 26" className="h-6 w-7">
            <path d="M15.5 12.8C9.7 10.9 4 9 2.2 3.8c5.8-1.2 10.7.9 14.3 7.1l-1 1.9Z" fill="var(--wing)" opacity="0.95" />
            <path d="M16.5 12.8C22.3 10.9 28 9 29.8 3.8c-5.8-1.2-10.7.9-14.3 7.1l1 1.9Z" fill="var(--wing)" opacity="0.95" />
            <path d="M15.2 14.3C9.8 14.8 5.8 17 5 22.1c4.9 1.7 9.4-.8 11.7-7l-1.5-.8Z" fill="#55e2b2" opacity="0.9" />
            <path d="M16.8 14.3c5.4.5 9.4 2.7 10.2 7.8-4.9 1.7-9.4-.8-11.7-7l1.5-.8Z" fill="#55e2b2" opacity="0.9" />
            <circle cx="16" cy="13.5" r="2" fill="#f7fdff" />
            <path d="M16 10.5v7.8" stroke="#16313a" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
};
