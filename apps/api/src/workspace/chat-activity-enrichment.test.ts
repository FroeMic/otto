import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { enrichWorkspaceChatMessageEventsWithTranscripts } from "./chat-activity-enrichment"

describe("enrichWorkspaceChatMessageEventsWithTranscripts", () => {
  it("enriches execute_integration_command events from the linked transcript tool call", () => {
    const events = enrichWorkspaceChatMessageEventsWithTranscripts({
      events: [
        {
          conversationId: "conv_1",
          createdAt: "2026-04-13T11:00:00.000Z",
          id: "evt_1",
          itemId: "tool:call_linear_1|fc_123",
          messageId: "msg_1",
          payload: {
            name: "execute_integration_command",
          },
          sequence: 1,
          sessionKey: "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          status: "completed",
          summary: "execute_integration_command",
          title: "execute_integration_command",
          type: "item.completed",
        },
      ],
      transcriptJsonlBySessionKey: new Map([
        [
          "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          [
            JSON.stringify({
              message: {
                content: [
                  {
                    arguments: {
                      arguments: {
                        query: "issues related to integrations",
                      },
                      commandKey: "issue.search",
                      integrationKey: "linear",
                    },
                    id: "call_linear_1",
                    name: "execute_integration_command",
                    type: "tool_call",
                  },
                ],
                role: "assistant",
                timestamp: 1,
              },
              type: "message",
            }),
          ].join("\n"),
        ],
      ]),
    })

    assert.equal(events[0]?.title, 'Search Linear issues for "issues related to integrations"')
    assert.equal(events[0]?.summary, "Query: issues related to integrations")
    assert.deepEqual(events[0]?.payload.activityPresentation, {
      iconKey: "linear",
      kind: "search",
      source: {
        commandKey: "issue.search",
        integrationKey: "linear",
        kind: "integration_command",
      },
      title: 'Search Linear issues for "issues related to integrations"',
    })
  })

  it("enriches find_integration_commands events from the linked transcript tool call", () => {
    const events = enrichWorkspaceChatMessageEventsWithTranscripts({
      events: [
        {
          conversationId: "conv_1",
          createdAt: "2026-04-13T11:00:00.000Z",
          id: "evt_1",
          itemId: "tool:call_find_1",
          messageId: "msg_1",
          payload: {
            name: "find_integration_commands",
          },
          sequence: 1,
          sessionKey: "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          status: "completed",
          title: "find_integration_commands",
          type: "item.completed",
        },
      ],
      transcriptJsonlBySessionKey: new Map([
        [
          "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          [
            JSON.stringify({
              message: {
                content: [
                  {
                    args: {
                      query:
                        "Linear issues related to integrations and read their descriptions",
                    },
                    id: "call_find_1",
                    name: "find_integration_commands",
                    type: "tool_call",
                  },
                ],
                role: "assistant",
                timestamp: 1,
              },
              type: "message",
            }),
          ].join("\n"),
        ],
      ]),
    })

    assert.equal(
      events[0]?.title,
      'Find integration commands for "Linear issues related to integrations and read their descriptions"',
    )
    assert.equal(
      events[0]?.summary,
      'Looking for commands matching "Linear issues related to integrations and read their descriptions"',
    )
    assert.deepEqual(events[0]?.payload.activityPresentation, {
      kind: "search",
      title:
        'Find integration commands for "Linear issues related to integrations and read their descriptions"',
    })
  })

  it("preserves explicit activity presentation from the runtime payload", () => {
    const events = enrichWorkspaceChatMessageEventsWithTranscripts({
      events: [
        {
          conversationId: "conv_1",
          createdAt: "2026-04-13T11:00:00.000Z",
          id: "evt_1",
          itemId: "tool:call_linear_1",
          messageId: "msg_1",
          payload: {
            activityPresentation: {
              kind: "search",
              title: "Already enriched",
            },
            name: "execute_integration_command",
          },
          sequence: 1,
          sessionKey: "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          status: "completed",
          title: "execute_integration_command",
          type: "item.completed",
        },
      ],
      transcriptJsonlBySessionKey: new Map(),
    })

    assert.equal(events[0]?.title, "execute_integration_command")
    assert.deepEqual(events[0]?.payload.activityPresentation, {
      kind: "search",
      title: "Already enriched",
    })
  })

  it("humanizes get_integration_details events from the linked transcript tool call", () => {
    const events = enrichWorkspaceChatMessageEventsWithTranscripts({
      events: [
        {
          conversationId: "conv_1",
          createdAt: "2026-04-13T11:00:00.000Z",
          id: "evt_1",
          itemId: "tool:call_details_1",
          messageId: "msg_1",
          payload: {
            name: "get_integration_details",
          },
          sequence: 1,
          sessionKey: "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          status: "completed",
          title: "get_integration_details",
          type: "item.completed",
        },
      ],
      transcriptJsonlBySessionKey: new Map([
        [
          "agent:main:otto-workspace-chat:channel:workspace:conv_1",
          [
            JSON.stringify({
              message: {
                content: [
                  {
                    arguments: {
                      commandPath: ["issue", "search"],
                      detailType: "command",
                      integrationKey: "linear",
                    },
                    id: "call_details_1",
                    name: "get_integration_details",
                    type: "tool_call",
                  },
                ],
                role: "assistant",
                timestamp: 1,
              },
              type: "message",
            }),
          ].join("\n"),
        ],
      ]),
    })

    assert.equal(events[0]?.title, "Reviewed Search Linear issues details")
    assert.deepEqual(events[0]?.payload.activityPresentation, {
      kind: "read",
      source: {
        commandKey: "issue.search",
        integrationKey: "linear",
        kind: "integration_command",
      },
      title: "Reviewed Search Linear issues details",
    })
  })
})
