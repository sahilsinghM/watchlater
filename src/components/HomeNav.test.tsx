import { describe, test, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeNav } from "./HomeNav";

afterEach(cleanup);

describe("HomeNav mobile toggle", () => {
  test("nav links are not in the DOM when the menu is closed", () => {
    render(<HomeNav />);
    expect(screen.queryByRole("link", { name: /how it works/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /what you get/i })).toBeNull();
  });

  test("a hamburger button is present with an accessible label", () => {
    render(<HomeNav />);
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeDefined();
  });

  test("clicking the hamburger reveals the nav links", async () => {
    const user = userEvent.setup();
    render(<HomeNav />);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));

    expect(screen.getByRole("link", { name: /how it works/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /what you get/i })).toBeDefined();
  });

  test("clicking the hamburger again removes the nav links", async () => {
    const user = userEvent.setup();
    render(<HomeNav />);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    await user.click(screen.getByRole("button", { name: /close navigation/i }));

    expect(screen.queryByRole("link", { name: /how it works/i })).toBeNull();
  });
});
