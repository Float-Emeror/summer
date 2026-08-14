import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoftSelect } from './SoftSelect';

describe('SoftSelect', () => {
  it('supports keyboard navigation and selection in the open listbox', async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <SoftSelect
        open
        value="one"
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
          { value: 'three', label: 'Three' },
        ]}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    );

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('closes on Escape while the menu is open', async () => {
    const onOpenChange = vi.fn();
    render(
      <SoftSelect
        open
        value="one"
        options={[{ value: 'one', label: 'One' }]}
        onChange={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    screen.getByRole('option', { name: 'One' }).focus();
    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
