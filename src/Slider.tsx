import React, { useState } from "react";

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void; // Optional callback for value change
}

const Slider: React.FC<SliderProps> = ({
  min,
  max,
  step,
  value,
  label,
  onChange,
}) => {
  // Handle slider value change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);

    onChange(newValue);
  };

  return (
    <div className="Slider__container">
      <label>
        {label}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="slider"
        />
      </label>
      <div className="slider-value">{value}</div>
    </div>
  );
};

export default Slider;
