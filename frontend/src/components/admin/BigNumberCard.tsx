interface BigNumberCardProps {
  label: string;
  value: number;
  suffix?: string;
}

export function BigNumberCard({ label, value, suffix }: BigNumberCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-card px-5 py-5">
      <p className="text-sm text-neutral-secondary mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-neutral-text">
        {value.toLocaleString('ru-RU')}
        {suffix && <span className="text-lg font-semibold text-neutral-secondary ml-1">{suffix}</span>}
      </p>
    </div>
  );
}