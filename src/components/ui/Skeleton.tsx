"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export default function Skeleton({ className = "", ...props }: SkeletonProps) {
  const classes = ["skeleton", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
