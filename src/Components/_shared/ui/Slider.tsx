import { Component } from 'solid-js';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color?: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

export const Slider: Component<SliderProps> = (props) => {
  const getDecimals = () => {
    if (props.step >= 1) return 0;
    if (props.step === 0.001) return 3;
    if (props.step <= 0.01) return 2;
    return 1;
  };

  const displayValue = () => {
    if (props.formatValue) {
      return props.formatValue(props.value);
    }
    return props.value.toFixed(getDecimals());
  };

  return (
    <div style={{ 'margin-bottom': '8px' }}>
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'margin-bottom': '2px',
        }}
      >
        <span style={{ color: '#aaa', 'font-size': '10px' }}>{props.label}</span>
        <span style={{ color: props.color || '#66ccff', 'font-size': '10px' }}>{displayValue()}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
        style={{ width: '100%', cursor: 'pointer' }}
      />
    </div>
  );
};
