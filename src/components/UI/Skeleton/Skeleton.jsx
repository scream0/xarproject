"use client";

import React from "react";
import styles from "./Skeleton.module.css";

/**
 * Skeleton Loading System — reusable primitives
 *
 * All placeholders are theme-aware (use --skeleton-base / --skeleton-shine
 * defined in globals.css for light & dark themes) and share the same
 * shimmer animation.
 */

export function Skeleton({
  variant = "block",
  width,
  height,
  radius,
  className = "",
  pulse = false,
  style = {},
  ...props
}) {
  const variantClass = {
    block: "",
    circle: styles.skeletonCircle,
    rect: styles.skeletonRect,
    text: styles.skeletonText,
  }[variant];

  const inlineStyle = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(radius ? { borderRadius: radius } : {}),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={[
        styles.skeleton,
        variantClass,
        pulse ? styles.skeletonPulse : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={inlineStyle}
      {...props}
    />
  );
}

/** Single text line (14px height) */
export function SkeletonText({
  width = "100%",
  height = 14,
  className = "",
  ...props
}) {
  return (
    <Skeleton
      variant="text"
      width={width}
      height={height}
      className={className}
      {...props}
    />
  );
}

/** Title-like line (22px height) */
export function SkeletonTitle({
  width = "60%",
  height = 22,
  className = "",
  ...props
}) {
  return (
    <Skeleton
      variant="text"
      width={width}
      height={height}
      className={className}
      {...props}
    />
  );
}

/** Circle placeholder (avatar / icon) */
export function SkeletonCircle({
  size = 40,
  className = "",
  ...props
}) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      className={className}
      {...props}
    />
  );
}

/** Rectangle / image placeholder */
export function SkeletonRect({
  width = "100%",
  height = 120,
  radius = 10,
  className = "",
  ...props
}) {
  return (
    <Skeleton
      variant="rect"
      width={width}
      height={height}
      radius={radius}
      className={className}
      {...props}
    />
  );
}

/** Button-like placeholder */
export function SkeletonButton({
  width = "100%",
  height = 40,
  className = "",
  ...props
}) {
  return (
    <Skeleton
      variant="rect"
      width={width}
      height={height}
      radius={10}
      className={[styles.skeletonButton, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

/** Card shell with padding + child skeletons */
export function SkeletonCard({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      className={[styles.skeletonCard, className].filter(Boolean).join(" ")}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

/** A group of skeleton text lines */
export function SkeletonLines({
  lines = 3,
  widths = ["100%", "92%", "75%"],
  gap = 0.75,
  className = "",
}) {
  return (
    <div
      className={[styles.skeletonLines, className].filter(Boolean).join(" ")}
      style={{ gap: `${gap}rem` }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText
          key={i}
          width={widths[i % widths.length]}
          height={13}
        />
      ))}
    </div>
  );
}

/**
 * Product-grid style block used inside grid layouts.
 * `count` controls how many cards are rendered.
 */
export function ProductCardSkeletons({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard
          key={`pcard-${i}`}
          className={styles.productCardSkeleton}
          style={{ height: "auto", padding: "0.85rem" }}
        >
          <SkeletonRect height={150} radius={10} />
          <div style={{ padding: "0.65rem 0.2rem 0.2rem" }}>
            <SkeletonTitle width="92%" height={16} />
            <div
              className={styles.flexRow}
              style={{ justifyContent: "space-between", marginTop: "0.6rem" }}
            >
              <SkeletonText width="40%" height={18} />
              <SkeletonCircle size={26} />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </>
  );
}

