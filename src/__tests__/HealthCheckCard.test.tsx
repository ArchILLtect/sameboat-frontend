import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HealthCheckCard from '../components/HealthCheckCard';

// Simple smoke test: component mounts, shows initial state, then transitions to OK after mock fetch

describe('HealthCheckCard', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'UP' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ) as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('mounts and displays health status', async () => {
    render(<HealthCheckCard intervalMs={60000} minSkeletonMs={0} />);
    expect(await screen.findByTestId('health-card')).toBeInTheDocument();
    expect(await screen.findByText(/Healthy/i)).toBeInTheDocument();
    expect(await screen.findByText(/status: UP/i)).toBeInTheDocument();
  });

  it('pauses after consecutive failures and resumes on click', async () => {
    // First three fetches fail, then succeed
    vi.restoreAllMocks();
    const fail = new Response('bad', { status: 500, headers: { 'Content-Type': 'text/plain' } }) as unknown as Response;
    const ok = new Response(JSON.stringify({ status: 'UP' }), { status: 200, headers: { 'Content-Type': 'application/json' } }) as unknown as Response;
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok);

  render(<HealthCheckCard intervalMs={100000} minSkeletonMs={0} failureThreshold={3} />);

  // Initial mount triggers first failure; click refresh twice for 2 more
  await screen.findByRole('alert'); // error alert present
  const refreshBtn = screen.getByRole('button', { name: /refresh now/i });
  fireEvent.click(refreshBtn);
  fireEvent.click(refreshBtn);

  await waitFor(() => expect(screen.getByTestId('health-paused')).toBeInTheDocument());
  expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Resume should trigger an immediate fetch and show healthy
    fireEvent.click(screen.getByTestId('resume-btn'));
    expect(await screen.findByText(/Healthy/i)).toBeInTheDocument();
  });
});
