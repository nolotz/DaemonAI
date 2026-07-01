import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { MoodPoint, TopicCount } from '@daemonai/shared';
import { useTheme } from '../context/ThemeContext';

/**
 * Farbwerte pro Modus – mit scripts/validate_palette.js (dataviz) gegen die
 * tatsächlichen Kartenflächen validiert (Lightness-Band, Chroma, Kontrast ≥ 3:1).
 * Beide Charts sind Single-Series: eine Farbe, keine Legende (Titel benennt die Serie).
 */
function useChartTheme() {
  const { isDark } = useTheme();
  return isDark
    ? {
        accent: '#46a862',
        grid: '#2c2c2a',
        axis: '#383835',
        ink: '#898781',
        text: '#f5f5f4',
        surface: '#1c1917',
        tooltipBg: '#292524',
        tooltipBorder: 'rgba(255,255,255,0.10)',
      }
    : {
        accent: '#428a58',
        grid: '#e1e0d9',
        axis: '#c3c2b7',
        ink: '#898781',
        text: '#1c1917',
        surface: '#fafaf9',
        tooltipBg: '#ffffff',
        tooltipBorder: 'rgba(11,11,11,0.10)',
      };
}

const shortDate = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(d)}.${Number(m)}.`;
};

function ChartTooltip({
  active,
  payload,
  title,
  value,
}: Pick<TooltipProps<number, string>, 'active' | 'payload'> & {
  title: (data: Record<string, unknown>) => string;
  value: (data: Record<string, unknown>) => string;
}) {
  const theme = useChartTheme();
  const data = payload?.[0]?.payload as Record<string, unknown> | undefined;
  if (!active || !data) return null;
  // Text in Ink-Tokens, nie in der Serienfarbe
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-sm"
      style={{
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        color: theme.text,
      }}
    >
      <div style={{ color: theme.ink }}>{title(data)}</div>
      <div className="font-medium">{value(data)}</div>
    </div>
  );
}

export function MoodChart({ data }: { data: MoodPoint[] }) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: theme.ink, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.axis }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          domain={[1, 10]}
          ticks={[2, 4, 6, 8, 10]}
          tick={{ fill: theme.ink, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
          content={
            <ChartTooltip
              title={(d) => shortDate(String(d.date))}
              value={(d) => `${d.mood ?? '–'} / 10`}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="mood"
          stroke={theme.accent}
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 2.5, fill: theme.accent, strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopicsChart({ data }: { data: TopicCount[] }) {
  const theme = useChartTheme();
  const topics = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={topics.length * 32 + 8}>
      <BarChart data={topics} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="topic"
          width={110}
          tick={{ fill: theme.text, fontSize: 13 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
          content={
            <ChartTooltip title={(d) => String(d.topic)} value={(d) => `${d.count}×`} />
          }
        />
        {/* 4px gerundetes Werte-Ende, an der Basislinie flach */}
        <Bar dataKey="count" fill={theme.accent} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" fill={theme.ink} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
