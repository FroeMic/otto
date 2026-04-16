import { describe, expect, it } from "vitest"

import {
  mergeLandingPromptTranscript,
  shouldSubmitLandingPromptFromKeydown,
} from "./prompt-composer-input"

describe("landing prompt composer input", () => {
  it("submits on Cmd+Enter", () => {
    expect(
      shouldSubmitLandingPromptFromKeydown({
        ctrlKey: false,
        isComposing: false,
        key: "Enter",
        metaKey: true,
        shiftKey: false,
      }),
    ).toBe(true)
  })

  it("submits on Ctrl+Enter", () => {
    expect(
      shouldSubmitLandingPromptFromKeydown({
        ctrlKey: true,
        isComposing: false,
        key: "Enter",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe(true)
  })

  it("does not submit on plain Enter", () => {
    expect(
      shouldSubmitLandingPromptFromKeydown({
        ctrlKey: false,
        isComposing: false,
        key: "Enter",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe(false)
  })

  it("does not submit while composing text", () => {
    expect(
      shouldSubmitLandingPromptFromKeydown({
        ctrlKey: false,
        isComposing: true,
        key: "Enter",
        metaKey: true,
        shiftKey: false,
      }),
    ).toBe(false)
  })

  it("appends voice transcript cleanly", () => {
    expect(
      mergeLandingPromptTranscript(
        "I want to run onboarding better.",
        "Help me set up support too.",
      ),
    ).toBe(
      "I want to run onboarding better.\nHelp me set up support too.",
    )
  })
})
