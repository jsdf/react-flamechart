import { useState } from 'react';

export default function NumberInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [textValue, setTextValue] = useState(value.toString());
  return (
    <div>
      <label>
        {label}:{' '}
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.currentTarget.value)}
          onBlur={() => onChange(parseFloat(textValue))}
        />
      </label>
    </div>
  );
}
