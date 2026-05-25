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
        background: 'var(--viz-button-bg, #555)',
        border: '1px solid var(--viz-button-border, transparent)',
        color: 'var(--viz-button-fg, white)',
        'border-radius': 'var(--viz-radius-sm, 4px)',
        cursor: 'pointer',
        'font-family': 'var(--viz-font, monospace)',
        'font-size': '11px',
      }}
    >
      {props.label || 'Reset to Defaults'}
    </button>
  );
};
