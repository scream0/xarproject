"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const data = [
  { name: "Mon", sales: 4000 },
  { name: "Tue", sales: 3000 },
  { name: "Wed", sales: 6000 },
  { name: "Thu", sales: 2780 },
  { name: "Fri", sales: 8900 },
  { name: "Sat", sales: 5390 },
  { name: "Sun", sales: 7490 },
];

export default function AnalyticsChart() {
  return (
    <div
      style={{
        width: "100%",
        height: 300,
        background: "rgba(18,18,18,0.4)",
        borderRadius: "12px",
        padding: "1rem",
      }}
    >
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="name"
            stroke="#525252"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#525252"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "#fbbf24" }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#fbbf24"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorSales)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
