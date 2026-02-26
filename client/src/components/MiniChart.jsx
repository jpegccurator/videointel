import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function MiniChart({ data }) {
  if (!data || !Array.isArray(data) || data.length < 2) return null;

  const chartData = data.map((d) => ({
    period: d.period,
    value: typeof d.value === 'number' ? d.value : parseFloat(String(d.value).replace(/[^0-9.\-]/g, '')) || 0,
  }));

  return (
    <div style={{ width: '100%', height: 120, marginTop: 12 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: '#66605C' }}
            tickLine={false}
            axisLine={{ stroke: '#E6D9CE' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#66605C' }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #E6D9CE',
              borderRadius: 4,
              fontSize: '0.8rem',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0D7680"
            strokeWidth={2}
            dot={{ r: 3, fill: '#0D7680' }}
            activeDot={{ r: 5, fill: '#0D7680' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
