import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import WidgetTelemetryPanel from "@/app/components/WidgetTelemetryPanel";

describe("WidgetTelemetryPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state and displays events", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            tool: "GitHub",
            endpoint: "issues",
            message: "timeout",
            timestamp: 1700000000000,
          },
        ],
      }),
    } as Response);

    render(<WidgetTelemetryPanel refreshKey={0} limit={5} />);

    expect(screen.getByText("Loading telemetry…")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("GitHub / issues")).toBeTruthy();
      expect(screen.getByText("timeout")).toBeTruthy();
    });
  });

  it("handles fetch errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    render(<WidgetTelemetryPanel refreshKey={1} limit={5} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Check telemetry endpoint permissions/i),
      ).toBeTruthy();
    });
  });

  it("refresh button triggers another fetch", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    } as Response);

    render(<WidgetTelemetryPanel refreshKey={2} limit={5} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
