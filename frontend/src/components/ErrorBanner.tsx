"use client";

import React from "react";

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

/**
 * Error/Info Banner — context-aware styling for errors (red) vs info messages (blue).
 * INFO: prefix triggers informational blue styling.
 */
export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  const isInfo = error.startsWith("INFO:");
  const message = isInfo ? error.slice(5) : error;

  return (
    <div
      className={`mb-6 p-4 ${
        isInfo
          ? "bg-blue-950/50 border-2 border-blue-500/50 text-blue-400"
          : "bg-red-950 border-2 border-red-500 text-red-500"
      } rounded-xl text-sm flex justify-between items-center shadow-lg font-medium`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{isInfo ? "ℹ️" : "⚠️"}</span>
        <span>{message}</span>
      </div>
      <button onClick={onDismiss} className="font-bold">
        ✕
      </button>
    </div>
  );
}
