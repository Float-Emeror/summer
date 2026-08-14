import type { UiOverrideConfig } from './types';

const serviceURL = import.meta.env.VITE_UI_CONFIG_SERVICE_URL ?? 'http://localhost:4317/ui-overrides';

export const emptyUiConfig: UiOverrideConfig = {
  version: 1,
  updatedAt: null,
  overrides: {},
};

export const uiConfigApi = {
  async load(): Promise<UiOverrideConfig> {
    const response = await fetch(serviceURL);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json() as Promise<UiOverrideConfig>;
  },

  async save(config: UiOverrideConfig): Promise<UiOverrideConfig> {
    const response = await fetch(serviceURL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: config.overrides }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json() as Promise<UiOverrideConfig>;
  },
};
