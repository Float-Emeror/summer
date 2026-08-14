import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { emptyUiConfig, uiConfigApi } from './uiConfigApi';
import { renderMarkdown } from './markdown';
import { toCssRules } from './styleRules';
import type { UiOverrideConfig } from './types';

interface UiConfigContextValue {
  config: UiOverrideConfig;
  refresh: () => Promise<void>;
  status: 'idle' | 'loaded' | 'error';
}

const UiConfigContext = createContext<UiConfigContextValue | null>(null);
const styleElementId = 'campus-ui-overrides';

function installStyle(config: UiOverrideConfig) {
  let styleElement = document.getElementById(styleElementId) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleElementId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = toCssRules(config);
}

function applyMarkdown(config: UiOverrideConfig) {
  for (const [selector, entry] of Object.entries(config.overrides)) {
    if (entry.markdown === undefined) {
      continue;
    }
    const html = renderMarkdown(entry.markdown ?? '');
    document.querySelectorAll(selector).forEach((element) => {
      if (element.innerHTML !== html) {
        element.innerHTML = html;
      }
    });
  }
}

export function UiConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<UiOverrideConfig>(emptyUiConfig);
  const [status, setStatus] = useState<UiConfigContextValue['status']>('idle');
  const configRef = useRef(config);

  async function refresh() {
    try {
      const nextConfig = await uiConfigApi.load();
      configRef.current = nextConfig;
      setConfig(nextConfig);
      installStyle(nextConfig);
      applyMarkdown(nextConfig);
      setStatus('loaded');
    } catch {
      configRef.current = emptyUiConfig;
      setConfig(emptyUiConfig);
      installStyle(emptyUiConfig);
      setStatus('error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => applyMarkdown(configRef.current), 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ config, refresh, status }), [config, status]);

  return <UiConfigContext.Provider value={value}>{children}</UiConfigContext.Provider>;
}

export function useUiConfig() {
  const context = useContext(UiConfigContext);
  if (!context) {
    throw new Error('useUiConfig must be used within UiConfigProvider');
  }
  return context;
}
