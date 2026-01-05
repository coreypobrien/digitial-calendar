import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ChoreView from "./ChoreView.jsx";

// Mock global fetch
global.fetch = vi.fn();

// Mock Confetti to avoid Canvas/animation issues
vi.mock("./Confetti.jsx", () => ({
  default: ({ active }) => (active ? <div data-testid="confetti" /> : null),
}));

describe("ChoreView", () => {
  const mockData = {
    users: [
      {
        id: "u1",
        name: "Alice",
        color: "#f00",
        chores: [
          { id: "c1", label: "Task 1", done: false },
          { id: "c2", label: "Task 2", done: true },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
  });

  it("renders chores for users", async () => {
    render(<ChoreView />);
    
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Task 2")).toBeInTheDocument();
    });
  });

  it("toggles chore status optimistically and calls API", async () => {
    render(<ChoreView />);
    
    await waitFor(() => screen.getByText("Task 1"));

    const task1 = screen.getByText("Task 1").closest(".chore-item");
    
    fetch.mockResolvedValueOnce({ ok: true }); // Mock toggle success

    fireEvent.click(task1);

    // Should visually update immediately (optimistic)
    // The "chore-item--done" class or checkmark logic would apply. 
    // In our component, checkmark is rendered conditionally: {chore.done && "✓"}
    expect(screen.getAllByText("✓")).toHaveLength(2); // One existing, one new

    expect(fetch).toHaveBeenCalledWith("/api/chores/u1/c1/toggle", {
      method: "POST",
    });
  });

  it("shows confetti when all chores are done", async () => {
    // Start with 1 pending task
    render(<ChoreView />);
    await waitFor(() => {
       expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    
    vi.useFakeTimers();

    const task1Text = screen.getByText("Task 1");
    const task1 = task1Text.closest(".chore-item");
    
    fireEvent.click(task1);

    // Flush microtasks/React updates
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId("confetti")).toBeInTheDocument();
    
    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // It should be gone
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
    
    vi.useRealTimers();
  });
});
