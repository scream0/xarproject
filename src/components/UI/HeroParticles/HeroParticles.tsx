"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulseAngle: number;
  color: string;
};

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Palet warna tema Emerald & Lavender untuk semburan atom parfum mewah
    const colors = [
      "rgba(15, 118, 110, 0.55)",  // Emerald Green
      "rgba(52, 211, 153, 0.5)",   // Light Emerald
      "rgba(167, 139, 250, 0.55)", // Soft Lavender
      "rgba(196, 181, 253, 0.45)", // Pale Lavender
      "rgba(255, 255, 255, 0.6)",  // Kristal Putih Murni
    ];

    const particles: Particle[] = [];
    const mouse = { x: -1000, y: -1000, radius: 180 };

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      }
    };
    window.addEventListener("resize", resize);
    resize();

    // 2. Inisialisasi partikel atom/molekul semprotan parfum (menyebar melingkar ke atas seperti mist)
    for (let i = 0; i < 85; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // Kecepatan menyebar ke atas dengan sedikit ayunan horizontal acak (efek semprotan mist/atomizer)
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 1.2 + 0.4), 
        radius: Math.random() * 2.8 + 0.8, // Ukuran bervariasi seperti partikel berat dan ringan
        baseAlpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        pulseAngle: Math.random() * Math.PI,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy; // Atom naik ke atas

        // Efek kedip/berkilau organiknya (seperti butir parfum yang memantulkan cahaya)
        p.pulseAngle += p.pulseSpeed;
        let currentAlpha = p.baseAlpha + Math.sin(p.pulseAngle) * 0.2;
        currentAlpha = Math.max(0.1, Math.min(1, currentAlpha));

        // Jika melewati batas atas layar, reset ke bagian bawah secara acak menyerupai semprotan baru
        if (p.y < -20) {
          p.y = canvas.height + 20;
          p.x = Math.random() * canvas.width;
          p.vx = (Math.random() - 0.5) * 0.4;
        }

        // Wrap horizontal agar tetap di dalam layar
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        // Interaksi lembut dengan kursor mouse (partikel bergeser elegan saat kursor mendekat)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          const angle = Math.atan2(dy, dx);
          const force = (mouse.radius - distance) / mouse.radius;
          p.x -= Math.cos(angle) * force * 3;
          p.y -= Math.sin(angle) * force * 3;
        }

        // 3. Render bentuk partikel bulat lembut menyerupai butiran atom/mist parfum mewah dengan efek glow
        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8; // Memberikan efek kilau atom yang menyebar

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    window.addEventListener("mousemove", handleMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}