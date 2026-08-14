export type UiStyleName =
  | 'color'
  | 'backgroundColor'
  | 'fontSize'
  | 'fontWeight'
  | 'borderRadius'
  | 'padding'
  | 'margin'
  | 'width'
  | 'height'
  | 'boxShadow'
  | 'opacity'
  | 'transform';

export type UiStyleOverrides = Partial<Record<UiStyleName, string>>;

export interface UiOverrideEntry {
  label: string;
  styles: UiStyleOverrides;
  markdown?: string;
}

export interface UiOverrideConfig {
  version: number;
  updatedAt: string | null;
  overrides: Record<string, UiOverrideEntry>;
}
