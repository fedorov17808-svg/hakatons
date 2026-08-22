"use client";

import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface RadarChartComponentProps {
  data: { subject: string; A: number }[];
}

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ data }) => {
  return (
    <div className="h-80 md:h-96 w-full bg-slate-900/40 rounded-2xl p-4 border border-white/5 flex items-center justify-center shadow-inner print:border-gray-300">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#334155" strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="subject" stroke="#cbd5e1" tick={{ fill: "#cbd5e1", fontSize: 13, fontWeight: 500 }} />
          <Radar name="Risk Index" dataKey="A" stroke="#22d3ee" strokeWidth={2} fill="#06b6d4" fillOpacity={0.4} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
