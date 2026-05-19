import { Component } from 'solid-js';

export interface ColorControlProps {
  label: string;
  r: number;
  g: number;
  b: number;
  onChange: (r: number, g: number, b: number) => void;
}

export const ColorControl: Component<ColorControlProps> = (props) => {
  return (
    <div
      style={{
        'margin-bottom': '12px',
        'padding-top': '8px',
        'border-top': '1px solid #444',
      }}
    >
      <div style={{ 'margin-bottom': '4px', color: '#aaa', 'font-weight': 'bold', 'font-size': '10px' }}>
        {props.label}
      </div>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <label style={{ flex: '1' }}>
          <span style={{ 'font-size': '10px', color: '#888' }}>R</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={props.r}
            onInput={(e) => props.onChange(parseFloat(e.currentTarget.value), props.g, props.b)}
            style={{ width: '100%' }}
          />
        </label>
        <label style={{ flex: '1' }}>
          <span style={{ 'font-size': '10px', color: '#888' }}>G</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={props.g}
            onInput={(e) => props.onChange(props.r, parseFloat(e.currentTarget.value), props.b)}
            style={{ width: '100%' }}
          />
        </label>
        <label style={{ flex: '1' }}>
          <span style={{ 'font-size': '10px', color: '#888' }}>B</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={props.b}
            onInput={(e) => props.onChange(props.r, props.g, parseFloat(e.currentTarget.value))}
            style={{ width: '100%' }}
          />
        </label>
        <div
          style={{
            width: '24px',
            height: '24px',
            'border-radius': '4px',
            background: `rgb(${props.r * 255}, ${props.g * 255}, ${props.b * 255})`,
            border: '1px solid #666',
          }}
        />
      </div>
    </div>
  );
};
