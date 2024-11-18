export default function Select({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label>
        {label}:{' '}
        <select
          value={value}
          onChange={(e) => {
            onChange(e.currentTarget.value);
          }}
        >
          {items.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
