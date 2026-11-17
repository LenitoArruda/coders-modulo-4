import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryConversationsRepository } from "../../../test/fakes/in-memory-conversations.repository";
import { FakeExpertResponder } from "../../../test/fakes/fake-expert-responder";
import {
  ModelUnavailableError,
  UnknownExpertError,
} from "../domain/conversation.errors";

import { GetConversationUseCase } from "./get-conversation.use-case";
import { SendMessageUseCase } from "./send-message.use-case";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

describe("SendMessageUseCase", () => {
  let conversations: InMemoryConversationsRepository;
  let responder: FakeExpertResponder;
  let sendMessage: SendMessageUseCase;
  let getConversation: GetConversationUseCase;

  beforeEach(() => {
    conversations = new InMemoryConversationsRepository();
    responder = new FakeExpertResponder();
    sendMessage = new SendMessageUseCase(conversations, responder);
    getConversation = new GetConversationUseCase(conversations);
  });

  it("persiste as duas mensagens na ordem e reusa a conversa do Expert", async () => {
    const first = await sendMessage.execute({
      userId: USER_A,
      expertId: "cto",
      prompt: "First question",
      source: "typed",
    });
    const second = await sendMessage.execute({
      userId: USER_A,
      expertId: "cto",
      prompt: "Second question",
      source: "suggestion",
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(conversations.conversations).toHaveLength(1);

    const transcript = await getConversation.execute({
      userId: USER_A,
      expertId: "cto",
    });

    expect(transcript.messages.map((message) => message.role)).toEqual([
      "user",
      "expert",
      "user",
      "expert",
    ]);
    expect(transcript.messages[2]?.content).toBe("Second question");
    expect(responder.calls.map((call) => call.expertId)).toEqual([
      "cto",
      "cto",
    ]);
    expect(responder.calls[1]?.prompt).toBe("Second question");
  });

  it("isolates transcripts between users", async () => {
    await sendMessage.execute({
      userId: USER_A,
      expertId: "ceo",
      prompt: "Private to A",
      source: "typed",
    });

    const transcriptB = await getConversation.execute({
      userId: USER_B,
      expertId: "ceo",
    });

    expect(transcriptB.conversationId).toBeNull();
    expect(transcriptB.messages).toEqual([]);
  });

  it("não persiste nada quando o modelo falha", async () => {
    responder.failWith = new Error("network down");

    await expect(
      sendMessage.execute({
        userId: USER_A,
        expertId: "cfo",
        prompt: "Question",
        source: "typed",
      }),
    ).rejects.toBeInstanceOf(ModelUnavailableError);

    expect(conversations.conversations).toHaveLength(0);
    expect(conversations.messages).toHaveLength(0);
  });

  it("rejeita Expert desconhecido sem chamar o modelo", async () => {
    await expect(
      sendMessage.execute({
        userId: USER_A,
        expertId: "unknown",
        prompt: "Question",
        source: "typed",
      }),
    ).rejects.toBeInstanceOf(UnknownExpertError);

    expect(responder.calls).toHaveLength(0);
  });
});
