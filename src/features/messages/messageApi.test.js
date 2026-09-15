import { describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "recipient-user-id",
          },
        },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      update: updateMock,
      insert: vi.fn(),
    })),
  },
}));

describe("Messaging", () => {
  it("should expose the message request functions", async () => {
    const messageApi = await import("./messageApi.js");

    expect(messageApi.getMessageRequests).toBeTypeOf("function");
    expect(messageApi.acceptRequest).toBeTypeOf("function");
    expect(messageApi.declineRequest).toBeTypeOf("function");
    expect(messageApi.getChats).toBeTypeOf("function");
    expect(messageApi.sendMessage).toBeTypeOf("function");
  });

  it("should reject an empty message", async () => {
    const { sendMessage } = await import("./messageApi.js");

    await expect(
      sendMessage("test-conversation-id", "   ")
    ).rejects.toThrow("Message cannot be empty.");
  });

  it("should send a trimmed message to the conversation", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "message-123",
            sender_id: "recipient-user-id",
            body: "Hello Flic'd!",
            created_at: "2026-09-15T05:00:00.000Z",
          },
          error: null,
        }),
      }),
    });

    const supabaseModule = await import("../../lib/supabase");

    supabaseModule.supabase.from.mockReturnValueOnce({
      insert: insertMock,
    });

    const { sendMessage } = await import("./messageApi.js");

    const result = await sendMessage(
      "conversation-123",
      "  Hello Flic'd!  "
    );

    expect(insertMock).toHaveBeenCalledWith({
      conversation_id: "conversation-123",
      sender_id: "recipient-user-id",
      body: "Hello Flic'd!",
    });

    expect(result.text).toBe("Hello Flic'd!");
  });

  it("should accept only the pending request belonging to the current recipient", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "request-123",
        sender_id: "sender-user-id",
        recipient_id: "recipient-user-id",
        status: "accepted",
      },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqStatusMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const eqRecipientMock = vi.fn().mockReturnValue({
      eq: eqStatusMock,
    });

    const eqIdMock = vi.fn().mockReturnValue({
      eq: eqRecipientMock,
    });

    updateMock.mockReturnValue({
      eq: eqIdMock,
    });

    const { acceptRequest } = await import("./messageApi.js");

    const result = await acceptRequest("request-123");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
      })
    );

    expect(eqIdMock).toHaveBeenCalledWith("id", "request-123");

    expect(eqRecipientMock).toHaveBeenCalledWith(
      "recipient_id",
      "recipient-user-id"
    );

    expect(eqStatusMock).toHaveBeenCalledWith(
      "status",
      "pending"
    );

    expect(result.status).toBe("accepted");
  });

  it("should decline only the pending request belonging to the current recipient", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "request-456",
        sender_id: "sender-user-id",
        recipient_id: "recipient-user-id",
        status: "declined",
      },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqStatusMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const eqRecipientMock = vi.fn().mockReturnValue({
      eq: eqStatusMock,
    });

    const eqIdMock = vi.fn().mockReturnValue({
      eq: eqRecipientMock,
    });

    updateMock.mockReturnValue({
      eq: eqIdMock,
    });

    const { declineRequest } = await import("./messageApi.js");

    const result = await declineRequest("request-456");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "declined",
      })
    );

    expect(eqIdMock).toHaveBeenCalledWith(
      "id",
      "request-456"
    );

    expect(eqRecipientMock).toHaveBeenCalledWith(
      "recipient_id",
      "recipient-user-id"
    );

    expect(eqStatusMock).toHaveBeenCalledWith(
      "status",
      "pending"
    );

    expect(result.status).toBe("declined");
  });
});
 