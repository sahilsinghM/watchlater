import { describe, test, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { FeedbackForm } from "./FeedbackForm";

afterEach(cleanup);

const noop = () => {};

describe("FeedbackForm label association", () => {
  test("the note textarea has an associated label", () => {
    render(
      <FeedbackForm
        reason=""
        name=""
        email=""
        emailError={null}
        feedbackState="idle"
        leadCaptured={false}
        onReasonChange={noop}
        onNameChange={noop}
        onEmailChange={noop}
        onUseful={noop}
        onNotUseful={noop}
      />,
    );
    expect(screen.getByLabelText(/optional note/i)).toBeDefined();
  });

  test("the name input has an associated label", () => {
    render(
      <FeedbackForm
        reason=""
        name=""
        email=""
        emailError={null}
        feedbackState="idle"
        leadCaptured={false}
        onReasonChange={noop}
        onNameChange={noop}
        onEmailChange={noop}
        onUseful={noop}
        onNotUseful={noop}
      />,
    );
    expect(screen.getByLabelText(/your name/i)).toBeDefined();
  });

  test("the email input has an associated label", () => {
    render(
      <FeedbackForm
        reason=""
        name=""
        email=""
        emailError={null}
        feedbackState="idle"
        leadCaptured={false}
        onReasonChange={noop}
        onNameChange={noop}
        onEmailChange={noop}
        onUseful={noop}
        onNotUseful={noop}
      />,
    );
    expect(screen.getByLabelText(/email/i)).toBeDefined();
  });
});
