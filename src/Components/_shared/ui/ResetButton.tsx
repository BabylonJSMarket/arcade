import { Component } from 'solid-js';

export interface ResetButtonProps {
  onClick: () => void;
  label?: string;
}

export const ResetButton: Component<ResetButtonProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      style={{
        width: '100%',
        padding: '8px',
        'margin-top': '16px',
        background: '#555',
        border: 'none',
        color: 'white',
        'border-radius': '4px',
        cursor: 'pointer',
        'font-family': 'monospace',
        'font-size': '11px',
      }}
    >
      {props.label || 'Reset to Defaults'}
    </button>
  );
};
