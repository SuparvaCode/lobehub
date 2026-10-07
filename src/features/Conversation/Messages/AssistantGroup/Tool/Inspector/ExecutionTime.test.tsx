/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ExecutionTime from './ExecutionTime';

describe('ExecutionTime', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses the provided operation start time after remounting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const { unmount } = render(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        startTime={8000}
        timerKey="tool-with-operation"
      />,
    );

    expect(screen.getByText('2.0s')).toBeTruthy();

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    render(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        startTime={8000}
        timerKey="tool-with-operation"
      />,
    );

    expect(screen.getByText('3.0s')).toBeTruthy();
  });

  it('keeps the cached start time when the timer remounts without operation metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const { unmount } = render(
      <ExecutionTime isExecuting messageId="existing-test-message" timerKey="tool-with-cache" />,
    );

    expect(screen.getByText('0ms')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.getByText('2.5s')).toBeTruthy();

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    render(
      <ExecutionTime isExecuting messageId="existing-test-message" timerKey="tool-with-cache" />,
    );

    expect(screen.getByText('3.5s')).toBeTruthy();
  });

  it('clears the cached start time when an active timer stays unmounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const { unmount } = render(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        timerKey="tool-active-unmount"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('1.5s')).toBeTruthy();

    unmount();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    render(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        timerKey="tool-active-unmount"
      />,
    );

    expect(screen.getByText('0ms')).toBeTruthy();
  });

  it('formats elapsed times longer than a minute as Xm Ys', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const { rerender } = render(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        startTime={10_000}
        timerKey="tool-minutes"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(83_000);
    });

    expect(screen.getByText('1m 23s')).toBeTruthy();

    rerender(
      <ExecutionTime
        isExecuting
        messageId="existing-test-message"
        startTime={10_000}
        timerKey="tool-minutes"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('2m 23s')).toBeTruthy();
  });

  it('clears the cached start time when execution stops', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const { rerender } = render(
      <ExecutionTime isExecuting messageId="existing-test-message" timerKey="tool-stop" />,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('1.5s')).toBeTruthy();

    rerender(
      <ExecutionTime isExecuting={false} messageId="existing-test-message" timerKey="tool-stop" />,
    );

    expect(screen.queryByText('1.5s')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    rerender(<ExecutionTime isExecuting messageId="existing-test-message" timerKey="tool-stop" />);

    expect(screen.getByText('0ms')).toBeTruthy();
  });
  /** @example Switching between two Codex messages with item_1 keeps separate clocks. */
  it('isolates reused tool ids across messages while preserving each remount', () => {
    // ROOT CAUSE:
    // Codex exec emits item_1 in independent topics and resumed turns.
    // Caching only by that id lets the next message inherit the previous timer.
    // Scope the cache by the owning message and tool id so each run keeps its clock.
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const first = render(<ExecutionTime isExecuting messageId="message-a" timerKey="item_1" />);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    first.unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const second = render(<ExecutionTime isExecuting messageId="message-b" timerKey="item_1" />);
    /** @example Message B starts at zero although A started 3.5 seconds earlier. */
    expect(screen.getByText('0ms')).toBeTruthy();
    second.rerender(<ExecutionTime isExecuting={false} messageId="message-b" timerKey="item_1" />);
    second.unmount();

    render(<ExecutionTime isExecuting messageId="message-a" timerKey="item_1" />);
    /** @example Returning to A preserves A's elapsed time. */
    expect(screen.getByText('3.5s')).toBeTruthy();
  });
});
