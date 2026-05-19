import { Component, JSX } from 'solid-js';

export interface SectionProps {
  title: string;
  color?: string;
  children: JSX.Element;
}

export const Section: Component<SectionProps> = (props) => {
  return (
    <div
      style={{
        'margin-bottom': '12px',
        'padding-bottom': '8px',
        'border-bottom': '1px solid #444',
      }}
    >
      <strong style={{ color: props.color || '#ffa500' }}>{props.title}</strong>
      <div style={{ 'margin-top': '8px' }}>{props.children}</div>
    </div>
  );
};
