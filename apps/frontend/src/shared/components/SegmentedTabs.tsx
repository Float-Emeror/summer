import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';

export type SegmentedTab<TValue extends string> = {
  value: TValue;
  label: string;
};

type SegmentedTabsProps<TValue extends string> = {
  ariaLabel: string;
  className?: string;
  tabs: SegmentedTab<TValue>[];
  activeValue: TValue;
  onChange: (value: TValue) => void;
};

export function SegmentedTabs<TValue extends string>({
  ariaLabel,
  className,
  tabs,
  activeValue,
  onChange,
}: SegmentedTabsProps<TValue>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [sliderStyle, setSliderStyle] = useState({ left: 4, width: 0 });
  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.value === activeValue),
    0,
  );
  useLayoutEffect(() => {
    function updateSlider() {
      const container = containerRef.current;
      const activeButton = buttonRefs.current[activeIndex];
      if (!container || !activeButton) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setSliderStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }

    updateSlider();
    const container = containerRef.current;
    const activeButton = buttonRefs.current[activeIndex];
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateSlider)
        : null;
    if (resizeObserver) {
      if (container) resizeObserver.observe(container);
      if (activeButton) resizeObserver.observe(activeButton);
    }
    window.addEventListener('resize', updateSlider);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSlider);
    };
  }, [activeIndex, tabs.length]);

  const style = {
    '--tab-count': tabs.length,
    '--active-index': activeIndex,
    '--active-tab-left': `${sliderStyle.left}px`,
    '--active-tab-width': `${sliderStyle.width}px`,
  } as CSSProperties;
  const rootClassName = ['segmented-tabs', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} aria-label={ariaLabel} ref={containerRef} role="tablist" style={style}>
      {tabs.map((tab, index) => (
        <button
          aria-selected={tab.value === activeValue}
          className={tab.value === activeValue ? 'active' : undefined}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
