import { Inject, Injectable } from "@nestjs/common";
import type { Pool, QueryResult } from "pg";

import {
  ConversationsRepositoryPort,
  type PersistedExchange,
} from "../application/ports/conversations-repository.port";
import type {
  Conversation,
  ConversationMessage,
  MessageRole,
  NewExchange,
} from "../domain/conversation";
import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";
import { databaseFailure } from "../../auth/infrastructure/database-error";

const CONVERSATION_COLUMNS = "id, user_id, expert_id, created_at, updated_at";
const MESSAGE_COLUMNS = "id, conversation_id, role, content, created_at";
const MESSAGE_SELECT =
  "m.id, m.conversation_id, m.role, m.content, m.created_at";

type ConversationRow = {
  id: string;
  user_id: string;
  expert_id: string;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: Date;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    expertId: row.expert_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

/**
 * Chat transcripts on top of `pg`. Every query is scoped by user id, and only
 * table names, operations and SQLSTATEs reach telemetry — never content.
 */
@Injectable()
export class PostgresConversationsRepository extends ConversationsRepositoryPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async findByUserAndExpert(
    userId: string,
    expertId: string,
  ): Promise<Conversation | null> {
    try {
      const result = await withDbSpan(
        { table: "conversations", operation: "SELECT" },
        () =>
          this.pool.query<ConversationRow>(
            `select ${CONVERSATION_COLUMNS}
             from public.conversations
             where user_id = $1 and expert_id = $2`,
            [userId, expertId],
          ),
      );

      const row = result.rows[0];

      return row === undefined ? null : toConversation(row);
    } catch (error) {
      throw databaseFailure("load conversation", error);
    }
  }

  async create(userId: string, expertId: string): Promise<Conversation> {
    try {
      const inserted = await withDbSpan(
        { table: "conversations", operation: "INSERT" },
        () =>
          this.pool.query<ConversationRow>(
            `insert into public.conversations (user_id, expert_id)
             values ($1, $2)
             on conflict (user_id, expert_id) do nothing
             returning ${CONVERSATION_COLUMNS}`,
            [userId, expertId],
          ),
      );

      const row = inserted.rows[0];

      // A concurrent request may have created the same conversation. The
      // unique constraint makes the re-read safe and keeps one row per pair.
      if (row !== undefined) {
        return toConversation(row);
      }

      const existing = await this.findByUserAndExpert(userId, expertId);

      if (existing === null) {
        throw new Error("conversation insert returned no row");
      }

      return existing;
    } catch (error) {
      throw databaseFailure("create conversation", error);
    }
  }

  async listMessages(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMessage[]> {
    try {
      const result = await withDbSpan(
        { table: "messages", operation: "SELECT" },
        () =>
          this.pool.query<MessageRow>(
            `select ${MESSAGE_SELECT}
             from public.messages m
             join public.conversations c on c.id = m.conversation_id
             where m.conversation_id = $1 and c.user_id = $2
             order by m.created_at asc, m.id asc`,
            [conversationId, userId],
          ),
      );

      return result.rows.map(toMessage);
    } catch (error) {
      throw databaseFailure("list messages", error);
    }
  }

  async appendExchange(
    conversationId: string,
    userId: string,
    exchange: NewExchange,
  ): Promise<PersistedExchange> {
    try {
      const owned = await withDbSpan(
        { table: "conversations", operation: "UPDATE" },
        () =>
          this.pool.query(
            `update public.conversations
             set updated_at = now()
             where id = $1 and user_id = $2`,
            [conversationId, userId],
          ),
      );

      if (owned.rowCount !== 1) {
        throw new Error("conversation is not owned by the user");
      }

      const result: QueryResult<MessageRow> = await withDbSpan(
        { table: "messages", operation: "INSERT" },
        () =>
          this.pool.query<MessageRow>(
            `insert into public.messages (conversation_id, role, content)
             values ($1, 'user', $2), ($1, 'expert', $3)
             returning ${MESSAGE_COLUMNS}`,
            [conversationId, exchange.userContent, exchange.expertContent],
          ),
      );

      const userRow = result.rows.find((row) => row.role === "user");
      const expertRow = result.rows.find((row) => row.role === "expert");

      if (userRow === undefined || expertRow === undefined) {
        throw new Error("exchange insert returned incomplete rows");
      }

      return {
        userMessage: toMessage(userRow),
        expertMessage: toMessage(expertRow),
      };
    } catch (error) {
      throw databaseFailure("persist exchange", error);
    }
  }
}
