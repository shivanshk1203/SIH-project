import React from "react";

// ============================================================================
// 1. Time Series Line Chart (Light Mode)
// ============================================================================
interface TimeSeriesProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  fillOpacity?: number;
  unit?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesProps> = ({
  data,
  height = 140,
  color = "#2563eb",
  fillOpacity = 0.12,
  unit = "",
}) => {
  if (!data || data.length === 0) return null;

  const width = 380;
  const padding = { top: 15, right: 15, bottom: 25, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 10);
  const minVal = 0;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / (maxVal - minVal)) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${
    padding.top + chartH
  } Z`;

  return (
    <div style={{ width: "100%", height, overflow: "hidden" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={`grad-light-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = padding.top + chartH * pct;
          const val = Math.round(maxVal * (1 - pct));
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fill="#64748b"
                fontSize="9"
                fontFamily="JetBrains Mono"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Fill area */}
        <path d={areaD} fill={`url(#grad-light-${color})`} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />

        {/* Data points & X axis labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke={color} strokeWidth="1.5" />
            {i % 2 === 0 && (
              <text
                x={p.x}
                y={height - 6}
                fill="#64748b"
                fontSize="9"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

// ============================================================================
// 2. Baseline Comparison Chart (Light Mode)
// ============================================================================
interface BaselineComparisonProps {
  data: { time: string; baseline: number; current: number }[];
  height?: number;
}

export const BaselineComparisonChart: React.FC<BaselineComparisonProps> = ({
  data,
  height = 180,
}) => {
  const width = 500;
  const padding = { top: 20, right: 20, bottom: 25, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.baseline, d.current]), 50);

  const baselinePts = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.baseline / maxVal) * chartH,
  }));

  const currentPts = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.current / maxVal) * chartH,
  }));

  const baselineD = baselinePts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
  const currentD = currentPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");

  return (
    <div style={{ width: "100%", height, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: "16px", marginBottom: "8px", fontSize: "11px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b" }}>
          <span style={{ width: "12px", height: "2px", background: "#94a3b8", display: "inline-block" }} />
          Historical Baseline (Nominal MW)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#dc2626" }}>
          <span style={{ width: "12px", height: "2px", background: "#dc2626", display: "inline-block" }} />
          Current Thermal Activity (MW)
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height - 24}`} style={{ width: "100%", flex: 1 }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = padding.top + chartH * pct;
          const val = Math.round(maxVal * (1 - pct));
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
              <text x={padding.left - 6} y={y + 3} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">
                {val}M
              </text>
            </g>
          );
        })}

        {/* Baseline (Dashed) */}
        <path d={baselineD} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />

        {/* Current Activity (Solid Red) */}
        <path d={currentD} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />

        {/* Highlight Peak */}
        {currentPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 4 ? "4" : "2"} fill="#dc2626" />
        ))}

        {/* Labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={padding.left + (i / (data.length - 1)) * chartW}
            y={height - 28}
            fill="#64748b"
            fontSize="9"
            fontFamily="JetBrains Mono"
            textAnchor="middle"
          >
            {d.time}
          </text>
        ))}
      </svg>
    </div>
  );
};

// ============================================================================
// 3. Donut Distribution Chart (Light Mode)
// ============================================================================
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export const DonutChart: React.FC<{ data: DonutSlice[]; size?: number; label?: string }> = ({
  data,
  size = 130,
  label = "Total",
}) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = size / 2;
  const strokeWidth = 14;
  const innerRadius = radius - strokeWidth;

  let accumulatedAngle = -90;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((slice, idx) => {
            const sliceAngle = (slice.value / total) * 360;
            const startAngle = accumulatedAngle;
            const endAngle = accumulatedAngle + sliceAngle;
            accumulatedAngle += sliceAngle;

            const x1 = radius + innerRadius * Math.cos((startAngle * Math.PI) / 180);
            const y1 = radius + innerRadius * Math.sin((startAngle * Math.PI) / 180);
            const x2 = radius + innerRadius * Math.cos((endAngle * Math.PI) / 180);
            const y2 = radius + innerRadius * Math.sin((endAngle * Math.PI) / 180);

            const largeArc = sliceAngle > 180 ? 1 : 0;
            const d = `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${x2} ${y2}`;

            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "16px", fontWeight: 800, fontFamily: "JetBrains Mono", color: "#0f172a" }}>
            {total}
          </span>
          <span style={{ fontSize: "9px", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.02em" }}>
            {label}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px" }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
            <span style={{ color: "#475569" }}>{item.label}:</span>
            <strong style={{ color: "#0f172a", fontFamily: "JetBrains Mono" }}>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 4. Horizontal Bar Chart (Light Mode)
// ============================================================================
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxVal?: number;
}

export const HorizontalBarChart: React.FC<BarChartProps> = ({ data, maxVal }) => {
  const max = maxVal || Math.max(...data.map((d) => d.value), 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      {data.map((item, idx) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span style={{ color: "#334155", fontWeight: 500 }}>{item.label}</span>
              <span style={{ color: "#0f172a", fontFamily: "JetBrains Mono", fontWeight: 700 }}>
                {item.value}
              </span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: item.color || "#2563eb",
                  borderRadius: "3px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
