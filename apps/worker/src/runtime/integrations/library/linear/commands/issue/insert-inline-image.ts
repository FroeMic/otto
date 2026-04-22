import type { IntegrationCommandExecute } from "../../../../framework"

import { normalizeOptionalString } from "../../client"
import {
  type LinearInlineImageFallback,
  type LinearInlineImagePosition,
  updateLinearIssueDescriptionWithInlineImage,
} from "./inline-image"

function normalizeInlineImagePosition(
  value: unknown,
): LinearInlineImagePosition {
  return value === "after_text" ||
    value === "before_text" ||
    value === "prepend" ||
    value === "replace_text"
    ? value
    : "append"
}

function normalizeInlineImageFallback(
  value: unknown,
): LinearInlineImageFallback {
  return value === "append" || value === "prepend" ? value : "fail"
}

export const executeLinearIssueInsertInlineImage: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const identifierOrId =
      typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : ""
    const assetUrl =
      typeof args.assetUrl === "string" ? args.assetUrl.trim() : ""
    const altText = typeof args.altText === "string" ? args.altText.trim() : ""

    if (!identifierOrId || !assetUrl || !altText) {
      throw new Error(
        "issue.insert_inline_image requires identifierOrId, assetUrl, and altText.",
      )
    }

    return updateLinearIssueDescriptionWithInlineImage({
      accessToken: context.auth.accessToken,
      altText,
      anchorText: normalizeOptionalString(args.anchorText),
      assetUrl,
      commandKey: "issue.insert_inline_image",
      fallbackPosition: normalizeInlineImageFallback(args.fallbackPosition),
      identifierOrId,
      position: normalizeInlineImagePosition(args.position),
    })
  }
