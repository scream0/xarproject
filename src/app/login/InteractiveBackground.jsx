"use client";

import React, { useEffect, useRef } from "react";

export default function InteractiveBackground() {
  const glowRef1 = useRef(null);
  const glowRef2 = useRef(null);

  // Track current offset
  const currentOffset = useRef({ x: 0, y: 0 });
  // Track target offset from mouse
  const targetOffset = useRef({ x: 0, y: 0 });

  const requestRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Seberapa jauh glow "tertarik" (multiplier). 
      // Dikurangi drastis menjadi 0.08 agar efeknya sangat subtle (tidak lebay)
      const pullFactor = 1;

      // Membatasi pergeseran maksimal (clamp) agar tidak pernah bocor terlalu jauh
      // Maksimal bergeser sejauh 40px dari pusat ke segala arah
      const maxOffset = 120;

      let targetX = deltaX * pullFactor;
      let targetY = deltaY * pullFactor;

      // Hitung jarak vektor
      const dist = Math.sqrt(targetX * targetX + targetY * targetY);
      if (dist > maxOffset) {
        targetX = (targetX / dist) * maxOffset;
        targetY = (targetY / dist) * maxOffset;
      }

      targetOffset.current = {
        x: targetX,
        y: targetY,
      };
    };

    const animate = () => {
      // Lerp (Linear Interpolation) for buttery smooth hardware-accelerated movement
      currentOffset.current.x += (targetOffset.current.x - currentOffset.current.x) * 0.15;
      currentOffset.current.y += (targetOffset.current.y - currentOffset.current.y) * 0.15;

      if (glowRef1.current && glowRef2.current) {
        // Direct DOM manipulation bypasses React render cycle (Best Practice for 60fps)
        glowRef1.current.style.transform = `translate3d(${currentOffset.current.x}px, ${currentOffset.current.y}px, 0)`;
        glowRef2.current.style.transform = `translate3d(${currentOffset.current.x * 0.6}px, ${currentOffset.current.y * 0.6}px, 0)`;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1, // Berada di belakang form
        overflow: "hidden",
      }}
    >
      <div
        ref={glowRef1}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: "-225px",
          marginLeft: "-225px",
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(var(--primary-accent-rgb), 0.25) 0%, rgba(var(--primary-accent-rgb), 0) 70%)",
          filter: "blur(50px)",
          borderRadius: "50%",
          willChange: "transform", // Hardware acceleration hint
        }}
      />

      <div
        ref={glowRef2}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: "-175px",
          marginLeft: "-175px",
          width: "350px",
          height: "350px",
          background: "radial-gradient(circle, rgba(var(--primary-accent-rgb), 0.4) 0%, rgba(255, 255, 255, 0) 60%)",
          filter: "blur(60px)",
          borderRadius: "50%",
          willChange: "transform", // Hardware acceleration hint
        }}
      />
    </div>
  );
}
