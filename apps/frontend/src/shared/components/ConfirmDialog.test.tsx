import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('closes on Escape when not loading', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete item"
        description="This cannot be undone."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not close by Escape or backdrop while loading', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        loading
        title="Delete item"
        description="This cannot be undone."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('presentation'));

    expect(onCancel).not.toHaveBeenCalled();
  });
});
