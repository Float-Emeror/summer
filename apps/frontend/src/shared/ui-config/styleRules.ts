import type { UiOverrideConfig, UiStyleOverrides } from './types';

const stylePropertyMap: Record<keyof UiStyleOverrides, string> = {
  color: 'color',
  backgroundColor: 'background-color',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  borderRadius: 'border-radius',
  padding: 'padding',
  margin: 'margin',
  width: 'width',
  height: 'height',
  boxShadow: 'box-shadow',
  opacity: 'opacity',
  transform: 'transform',
};

export function toCssRules(config: UiOverrideConfig) {
  return Object.entries(config.overrides)
    .map(([selector, entry]) => {
      const declarations = Object.entries(entry.styles)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([property, value]) => `  ${stylePropertyMap[property as keyof UiStyleOverrides]}: ${value} !important;`)
        .join('\n');

      if (!declarations) {
        return '';
      }

      return `${selector} {\n${declarations}\n}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
