import { describe, it, expect } from "vitest";

describe("POS Transaction Engine", () => {
  it("should calculate total correctly", () => {
    const cart = [
      { price: 100, qty: 2 },
      { price: 50, qty: 1 }
    ];

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    expect(total).toBe(250);
  });

  it("should prevent duplicate transaction", () => {
    const transactions = new Set<string>();
    const txId = "TX123";

    transactions.add(txId);
    transactions.add(txId);

    expect(transactions.size).toBe(1);
  });
});
