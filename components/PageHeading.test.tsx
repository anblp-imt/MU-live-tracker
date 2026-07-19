import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { PageHeading } from './PageHeading';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-18T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('PageHeading', () => {
  it('renders the title as an h1', () => {
    render(<PageHeading title="Today" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('renders a live clock showing the current date and time', () => {
    render(<PageHeading title="Today" />);
    act(() => { vi.advanceTimersByTime(0); }); // flush the mount effect
    expect(screen.getByTestId('page-clock')).toHaveTextContent('18 July 2026');
  });

  it('ticks forward every second without a remount', () => {
    render(<PageHeading title="Today" />);
    act(() => { vi.advanceTimersByTime(0); });
    const first = screen.getByTestId('page-clock').textContent;

    act(() => { vi.advanceTimersByTime(1000); });
    const second = screen.getByTestId('page-clock').textContent;

    expect(second).not.toBe(first);
  });

  it('does not render a Refresh button when onRefresh is omitted', () => {
    render(<PageHeading title="Today" />);
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('calls onRefresh when the Refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(<PageHeading title="Today" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the Refresh button while refreshing', () => {
    render(<PageHeading title="Today" onRefresh={() => {}} refreshing />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
