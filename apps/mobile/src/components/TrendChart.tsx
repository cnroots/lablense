import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { colors } from "../theme/theme";

export interface ChartPoint {
  value: number;
  measuredAt: string;
  outside?: boolean;
}

interface TrendChartProps {
  points: ChartPoint[];
  width?: number;
  height?: number;
  refMin?: number;
  refMax?: number;
  showRefs?: boolean;
  showMean?: boolean;
  highlightOutside?: boolean;
}

export function TrendChart({
  points,
  width = 300,
  height = 82,
  refMin,
  refMax,
  showRefs = false,
  showMean = false,
  highlightOutside = false
}: TrendChartProps) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((p) => p.value);
  const domain = [...values];
  if (showRefs && refMin !== undefined) domain.push(refMin);
  if (showRefs && refMax !== undefined) domain.push(refMax);

  let min = Math.min(...domain);
  let max = Math.max(...domain);
  const pad = (max - min || Math.max(Math.abs(max), 1)) * 0.13;
  min -= pad;
  max += pad;

  const padX = 7;
  const range = max - min || 1;
  const y = (v: number) =>
    height - padX - ((v - min) / range) * (height - 2 * padX);

  const step = points.length > 1 ? (width - 2 * padX) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? padX + i * step : width / 2,
    y: y(p.value),
    outside: !!p.outside
  }));

  const mean =
    values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {showRefs &&
          refMin !== undefined &&
          Number.isFinite(refMin) && (
            <Line
              x1={padX}
              y1={y(refMin)}
              x2={width - padX}
              y2={y(refMin)}
              stroke={colors.reference}
              strokeWidth={1.5}
              strokeDasharray="7 5"
            />
          )}
        {showRefs &&
          refMax !== undefined &&
          Number.isFinite(refMax) && (
            <Line
              x1={padX}
              y1={y(refMax)}
              x2={width - padX}
              y2={y(refMax)}
              stroke={colors.reference}
              strokeWidth={1.5}
              strokeDasharray="7 5"
            />
          )}
        {showMean && (
          <Line
            x1={padX}
            y1={y(mean)}
            x2={width - padX}
            y2={y(mean)}
            stroke={colors.orange}
            strokeWidth={1.5}
          />
        )}
        <Polyline
          points={polyline}
          fill="none"
          stroke={colors.blue}
          strokeWidth={2}
        />
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={highlightOutside && c.outside ? 4.5 : 3.4}
            fill={highlightOutside && c.outside ? colors.orange : colors.blue}
            stroke={highlightOutside && c.outside ? "#FFFFFF" : "none"}
            strokeWidth={highlightOutside && c.outside ? 1.5 : 0}
          />
        ))}
      </Svg>
    </View>
  );
}
