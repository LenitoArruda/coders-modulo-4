import type { Metadata } from "next";

import { fetchApiWithSession } from "../../lib/auth/api-client";
import { requireSessionUser } from "../../lib/auth/guards";
import {
  LOAD_FAILED_MESSAGE,
  type ChatMessage,
  type ConversationResponse,
  type Expert,
  type ExpertsResponse,
} from "../../lib/expert-chat/types";
import { ExpertChat } from "./_components/expert-chat";

export const metadata: Metadata = {
  title: "Experts",
};

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Private home. The catalog and the first Expert's transcript are read on the
 * server with the session cookie; the token never reaches the rendered HTML or
 * the client bundle.
 */
export default async function AppHomePage() {
  const user = await requireSessionUser();

  let experts: Expert[] = [];
  let initialMessages: ChatMessage[] = [];
  let loadError: string | null = null;

  try {
    const catalogResponse = await fetchApiWithSession("/api/v1/experts", {
      cache: "no-store",
    });

    if (!catalogResponse.ok) {
      throw new Error("expert catalog unavailable");
    }

    const catalog = await readJson<ExpertsResponse>(catalogResponse);

    if (catalog === null) {
      throw new Error("invalid expert catalog");
    }

    experts = catalog.experts;

    const initialExpertId = experts[0]?.id;

    if (initialExpertId !== undefined) {
      const query = new URLSearchParams({ expertId: initialExpertId });
      const conversationResponse = await fetchApiWithSession(
        `/api/v1/conversations?${query}`,
        { cache: "no-store" },
      );

      if (conversationResponse.ok) {
        const conversation =
          await readJson<ConversationResponse>(conversationResponse);

        if (conversation !== null) {
          initialMessages = conversation.messages;
        }
      }
    }
  } catch {
    loadError = LOAD_FAILED_MESSAGE;
  }

  return (
    <section aria-labelledby="app-home-title" className="space-y-8">
      <div className="max-w-2xl">
        <h1
          id="app-home-title"
          className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Welcome, {user.firstName}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Choose an Expert and ask a question. Every conversation stays in your
          account.
        </p>
      </div>

      <ExpertChat
        experts={experts}
        initialExpertId={experts[0]?.id ?? ""}
        initialMessages={initialMessages}
        initialError={loadError}
      />
    </section>
  );
}
