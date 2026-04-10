import {
  buildLinearIssueCommandResult,
  executeLinearGraphql,
  findLinearIssueByIdentifierOrId,
  getLinearIssueFields,
  type LinearIssueNode,
} from "../../client";

const UPDATE_ISSUE_MUTATION = `
  mutation OttoLinearIssueInlineImageUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      issue {
        ${getLinearIssueFields()}
      }
      lastSyncId
      success
    }
  }
`;

export type LinearInlineImagePosition =
  | "after_text"
  | "append"
  | "before_text"
  | "prepend"
  | "replace_text";

export type LinearInlineImageFallback = "append" | "fail" | "prepend";

function escapeInlineImageAltText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function appendMarkdownBlock(base: string, markdown: string) {
  return base ? `${base}\n\n${markdown}` : markdown;
}

function prependMarkdownBlock(base: string, markdown: string) {
  return base ? `${markdown}\n\n${base}` : markdown;
}

function applyFallbackInsert(input: {
  description: string;
  fallbackPosition: LinearInlineImageFallback;
  markdown: string;
}) {
  if (input.fallbackPosition === "append") {
    return {
      anchorMatched: false,
      description: appendMarkdownBlock(input.description, input.markdown),
      insertionMode: "append",
    };
  }

  if (input.fallbackPosition === "prepend") {
    return {
      anchorMatched: false,
      description: prependMarkdownBlock(input.description, input.markdown),
      insertionMode: "prepend",
    };
  }

  throw new Error(
    "anchorText was not found in the issue description and fallbackPosition was fail.",
  );
}

export function buildIssueDescriptionWithInlineImage(input: {
  altText: string;
  anchorText?: string | null;
  assetUrl: string;
  currentDescription?: string | null;
  fallbackPosition?: LinearInlineImageFallback | null;
  position?: LinearInlineImagePosition | null;
}) {
  const description = input.currentDescription ?? "";
  const fallbackPosition = input.fallbackPosition ?? "fail";
  const position = input.position ?? "append";
  const markdown = `![${escapeInlineImageAltText(input.altText)}](${input.assetUrl})`;

  if (position === "append") {
    return {
      anchorMatched: false,
      description: appendMarkdownBlock(description, markdown),
      insertionMode: "append",
      markdown,
    };
  }

  if (position === "prepend") {
    return {
      anchorMatched: false,
      description: prependMarkdownBlock(description, markdown),
      insertionMode: "prepend",
      markdown,
    };
  }

  const anchorText = input.anchorText?.trim() ?? "";

  if (!anchorText) {
    throw new Error(`anchorText is required when position is ${position}.`);
  }

  const anchorIndex = description.indexOf(anchorText);

  if (anchorIndex === -1) {
    return {
      ...applyFallbackInsert({
        description,
        fallbackPosition,
        markdown,
      }),
      markdown,
    };
  }

  if (position === "after_text") {
    const anchorEndIndex = anchorIndex + anchorText.length;

    return {
      anchorMatched: true,
      description: `${description.slice(0, anchorEndIndex)}\n\n${markdown}${description.slice(anchorEndIndex)}`,
      insertionMode: "after_text",
      markdown,
    };
  }

  if (position === "before_text") {
    return {
      anchorMatched: true,
      description: `${description.slice(0, anchorIndex)}${markdown}\n\n${description.slice(anchorIndex)}`,
      insertionMode: "before_text",
      markdown,
    };
  }

  return {
    anchorMatched: true,
    description: `${description.slice(0, anchorIndex)}${markdown}${description.slice(anchorIndex + anchorText.length)}`,
    insertionMode: "replace_text",
    markdown,
  };
}

export async function updateLinearIssueDescriptionWithInlineImage(input: {
  accessToken: string;
  altText: string;
  anchorText?: string | null;
  assetUrl: string;
  commandKey: string;
  fallbackPosition?: LinearInlineImageFallback | null;
  identifierOrId: string;
  position?: LinearInlineImagePosition | null;
}) {
  const issue = await findLinearIssueByIdentifierOrId({
    accessToken: input.accessToken,
    identifierOrId: input.identifierOrId,
  });

  if (!issue?.id) {
    throw new Error(`Linear could not find issue ${input.identifierOrId}.`);
  }

  const inlineImage = buildIssueDescriptionWithInlineImage({
    altText: input.altText,
    anchorText: input.anchorText,
    assetUrl: input.assetUrl,
    currentDescription: issue.description ?? "",
    fallbackPosition: input.fallbackPosition,
    position: input.position,
  });

  const data = await executeLinearGraphql<{
    issueUpdate?: {
      issue?: LinearIssueNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: input.accessToken,
    query: UPDATE_ISSUE_MUTATION,
    variables: {
      id: issue.id,
      input: {
        description: inlineImage.description,
      },
    },
  });

  return {
    ...buildLinearIssueCommandResult({
      commandKey: input.commandKey,
      issue: data.issueUpdate?.issue,
      lastSyncId: data.issueUpdate?.lastSyncId,
      success: data.issueUpdate?.success,
    }),
    anchorMatched: inlineImage.anchorMatched,
    insertedMarkdown: inlineImage.markdown,
    insertionMode: inlineImage.insertionMode,
    lookup: input.identifierOrId,
  };
}
