type MarketStat = {
  id?: string;
  value: string | number;
  label: string;
};

type MarketStatStripProps = {
  stats: MarketStat[];
};

export function MarketStatStrip({ stats }: MarketStatStripProps) {
  return (
    <div className="market-stat-strip">
      {stats.map((stat, index) => (
        <span key={stat.id ?? `${stat.label}-${index}`}>
          <strong>{stat.value}</strong>
          {stat.label}
        </span>
      ))}
    </div>
  );
}
