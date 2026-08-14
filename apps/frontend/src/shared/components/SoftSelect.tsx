import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SoftSelectOption<T extends string | number> = {
  value: T;
  label: string;
  helper?: string;
};

type SoftSelectProps<T extends string | number> = {
  className?: string;
  open: boolean;
  value: T;
  options: SoftSelectOption<T>[];
  onChange: (value: T) => void;
  onOpenChange: (open: boolean) => void;
  renderValue?: (option: SoftSelectOption<T>) => ReactNode;
  placeholder?: string;
};

// 带动画的下拉选择（与“发布组队”页类型选择同款）。
// 样式见 styles.css 中 .soft-picker / .soft-picker-menu。
export function SoftSelect<T extends string | number>({
  className,
  open,
  value,
  options,
  onChange,
  onOpenChange,
  renderValue,
  placeholder,
}: SoftSelectProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected?.value),
  );

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex;
    setActiveIndex(nextIndex);
    window.setTimeout(() => optionRefs.current[nextIndex]?.focus(), 0);

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open, selectedIndex]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenChange(true);
    }
  }

  function moveOption(offset: number) {
    if (options.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + offset + options.length) % options.length;
      optionRefs.current[next]?.focus();
      return next;
    });
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveOption(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveOption(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      optionRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = options.length - 1;
      setActiveIndex(lastIndex);
      optionRefs.current[lastIndex]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
    }
  }

  return (
    <div className={['soft-picker', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        className="soft-picker-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>
          <strong>{selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder ?? '请选择'}</strong>
        </span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="soft-picker-menu" role="listbox">
          {options.map((option, index) => (
            <button
              className={[option.value === value ? 'active' : '', index === activeIndex ? 'focused' : '']
                .filter(Boolean)
                .join(' ') || undefined}
              key={String(option.value)}
              type="button"
              title={option.helper}
              onClick={() => onChange(option.value)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={handleOptionKeyDown}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="option"
              aria-selected={option.value === value}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
