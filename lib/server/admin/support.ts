import "server-only";

import { randomUUID } from "node:crypto";

import { createCustomerNotification } from "@/lib/server/customer-notifications";
import { getAdminRuntimePool } from "@/lib/server/admin/runtime-db";

import type {
  SupportChatEntry,
  SupportMessage,
  SupportResponse,
} from "@/lib/shop/admin-types";

type SupportMessageRow = {
  id: string;
  order_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  category: "product" | "delivery" | "payment" | "other";
  source: "chatbot" | "email";
  customer_token: string | null;
  chat_entries_json: SupportChatEntry[] | null;
  responses_json: SupportResponse[] | null;
  admin_seen_at: string | null;
  customer_seen_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

function trimText(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function buildChatEntry(input: {
  sender: "customer" | "support";
  senderName: string;
  message: string;
  attachments?: string[];
  createdAt?: string;
}): SupportChatEntry {
  return {
    id: randomUUID(),
    sender: input.sender,
    senderName: trimText(input.senderName) || (input.sender === "support" ? "Soporte" : "Cliente"),
    message: trimText(input.message),
    attachments: Array.isArray(input.attachments)
      ? input.attachments.filter((attachment) => typeof attachment === "string" && attachment.trim())
      : undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function normalizeResponses(responses: SupportResponse[] | undefined) {
  return (Array.isArray(responses) ? responses : []).map((response) => ({
    id: response.id || randomUUID(),
    respondedBy: response.respondedBy,
    respondedByName: trimText(response.respondedByName) || "Soporte",
    message: trimText(response.message),
    attachments: response.attachments,
    createdAt: response.createdAt || new Date().toISOString(),
  }));
}

function normalizeChatEntries(message: SupportMessage, responses: SupportResponse[]) {
  if (Array.isArray(message.chatEntries) && message.chatEntries.length > 0) {
    return message.chatEntries
      .map((entry) => ({
        id: entry.id || randomUUID(),
        sender: entry.sender,
        senderName: trimText(entry.senderName) || (entry.sender === "support" ? "Soporte" : "Cliente"),
        message: trimText(entry.message),
        attachments: Array.isArray(entry.attachments)
          ? entry.attachments.filter((attachment) => typeof attachment === "string" && attachment.trim())
          : undefined,
        createdAt: entry.createdAt || message.createdAt,
      }))
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }

  const initialEntry = buildChatEntry({
    sender: "customer",
    senderName: message.customerName,
    message: message.message,
    createdAt: message.createdAt,
  });

  const responseEntries = responses.map((response) =>
    buildChatEntry({
      sender: "support",
      senderName: response.respondedByName,
      message: response.message,
      createdAt: response.createdAt,
    })
  );

  return [initialEntry, ...responseEntries];
}

function normalizeSupportMessage(message: SupportMessage): SupportMessage {
  const createdAt = message.createdAt || new Date().toISOString();
  const responses = normalizeResponses(message.responses);
  const chatEntries = normalizeChatEntries(
    {
      ...message,
      createdAt,
    },
    responses
  );

  return {
    ...message,
    customerName: trimText(message.customerName) || "Cliente",
    customerEmail: trimText(message.customerEmail),
    customerPhone: trimText(message.customerPhone),
    customerToken: trimText(message.customerToken),
    subject: trimText(message.subject) || "Soporte",
    message: trimText(message.message),
    category: message.category ?? "other",
    priority: message.priority ?? "medium",
    status: message.status ?? "open",
    source: message.source ?? "chatbot",
    responses,
    chatEntries,
    adminSeenAt: message.adminSeenAt ?? null,
    customerSeenAt: message.customerSeenAt ?? null,
    createdAt,
    updatedAt: message.updatedAt || createdAt,
    resolvedAt: message.resolvedAt ?? undefined,
  };
}

function mapSupportMessageRow(row: SupportMessageRow) {
  return normalizeSupportMessage({
    id: row.id,
    orderId: row.order_id ?? undefined,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone ?? undefined,
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    status: row.status,
    category: row.category,
    source: row.source,
    customerToken: row.customer_token ?? undefined,
    chatEntries: Array.isArray(row.chat_entries_json) ? row.chat_entries_json : [],
    responses: Array.isArray(row.responses_json) ? row.responses_json : [],
    adminSeenAt: row.admin_seen_at ?? null,
    customerSeenAt: row.customer_seen_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  });
}

async function readSupportMessages(): Promise<SupportMessage[]> {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<SupportMessageRow>(
    `
      SELECT
        id,
        order_id,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        subject,
        message,
        priority,
        status,
        category,
        source,
        customer_token,
        chat_entries_json,
        responses_json,
        admin_seen_at::text,
        customer_seen_at::text,
        created_at::text,
        updated_at::text,
        resolved_at::text
      FROM admin_support_messages
      ORDER BY updated_at DESC, created_at DESC
    `
  );

  return result.rows.map(mapSupportMessageRow);
}

async function writeSupportMessages(messages: SupportMessage[]) {
  const pool = await getAdminRuntimePool();
  const client = await pool.connect();
  const normalizedMessages = messages.map(normalizeSupportMessage);

  try {
    await client.query("BEGIN");

    for (const message of normalizedMessages) {
      await client.query(
        `
          INSERT INTO admin_support_messages (
            id,
            order_id,
            customer_id,
            customer_name,
            customer_email,
            customer_phone,
            subject,
            message,
            priority,
            status,
            category,
            source,
            customer_token,
            chat_entries_json,
            responses_json,
            admin_seen_at,
            customer_seen_at,
            created_at,
            updated_at,
            resolved_at
          ) VALUES (
            $1, $2, $3, $4, LOWER($5), $6, $7, $8, $9, $10, $11, $12, $13,
            $14::jsonb, $15::jsonb, $16::timestamptz, $17::timestamptz, $18::timestamptz,
            $19::timestamptz, $20::timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            order_id = EXCLUDED.order_id,
            customer_id = EXCLUDED.customer_id,
            customer_name = EXCLUDED.customer_name,
            customer_email = EXCLUDED.customer_email,
            customer_phone = EXCLUDED.customer_phone,
            subject = EXCLUDED.subject,
            message = EXCLUDED.message,
            priority = EXCLUDED.priority,
            status = EXCLUDED.status,
            category = EXCLUDED.category,
            source = EXCLUDED.source,
            customer_token = EXCLUDED.customer_token,
            chat_entries_json = EXCLUDED.chat_entries_json,
            responses_json = EXCLUDED.responses_json,
            admin_seen_at = EXCLUDED.admin_seen_at,
            customer_seen_at = EXCLUDED.customer_seen_at,
            updated_at = EXCLUDED.updated_at,
            resolved_at = EXCLUDED.resolved_at
        `,
        [
          message.id,
          message.orderId ?? null,
          message.customerId,
          message.customerName,
          message.customerEmail,
          message.customerPhone ?? null,
          message.subject,
          message.message,
          message.priority,
          message.status,
          message.category,
          message.source,
          message.customerToken ?? null,
          JSON.stringify(message.chatEntries ?? []),
          JSON.stringify(message.responses ?? []),
          message.adminSeenAt ?? null,
          message.customerSeenAt ?? null,
          message.createdAt,
          message.updatedAt,
          message.resolvedAt ?? null,
        ]
      );
    }

    const ids = normalizedMessages.map((message) => message.id);
    if (ids.length > 0) {
      await client.query(
        `DELETE FROM admin_support_messages WHERE NOT (id = ANY($1::text[]))`,
        [ids]
      );
    } else {
      await client.query(`DELETE FROM admin_support_messages`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function matchesCustomer(
  message: SupportMessage,
  input: {
    customerId?: string;
    customerToken?: string;
  }
) {
  if (input.customerId && message.customerId === input.customerId) {
    return true;
  }

  return Boolean(input.customerToken && message.customerToken === input.customerToken);
}

function getLastChatEntry(
  message: SupportMessage,
  sender?: "customer" | "support"
) {
  const entries = sender
    ? message.chatEntries.filter((entry) => entry.sender === sender)
    : message.chatEntries;

  return entries[entries.length - 1] ?? null;
}

export async function getAllSupportMessages(options?: {
  status?: "open" | "in_progress" | "resolved";
  priority?: "low" | "medium" | "high";
  category?: string;
}) {
  let messages = await readSupportMessages();

  if (options?.status) {
    messages = messages.filter((message) => message.status === options.status);
  }

  if (options?.priority) {
    messages = messages.filter((message) => message.priority === options.priority);
  }

  if (options?.category) {
    messages = messages.filter((message) => message.category === options.category);
  }

  return messages.sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export async function getSupportMessageById(id: string) {
  const messages = await readSupportMessages();
  return messages.find((message) => message.id === id) ?? null;
}

export async function getSupportMessagesByCustomer(customerId: string) {
  const messages = await readSupportMessages();
  return messages.filter((message) => message.customerId === customerId);
}

export async function getLatestSupportConversation(input: {
  customerId?: string;
  customerToken?: string;
}) {
  const messages = await readSupportMessages();
  const conversations = messages
    .filter((message) => matchesCustomer(message, input))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const activeConversation =
    conversations.find((message) => message.status !== "resolved") ?? conversations[0] ?? null;

  return activeConversation;
}

export async function createSupportMessage(input: {
  customerId: string;
  customerToken?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string;
  subject: string;
  message: string;
  attachments?: string[];
  category: "product" | "delivery" | "payment" | "other";
  priority?: "low" | "medium" | "high";
  source?: "chatbot" | "email";
}) {
  const now = new Date().toISOString();
  const initialEntry = buildChatEntry({
    sender: "customer",
    senderName: input.customerName,
    message: input.message,
    attachments: input.attachments,
    createdAt: now,
  });

  const message: SupportMessage = {
    id: randomUUID(),
    customerId: input.customerId,
    customerToken: trimText(input.customerToken),
    customerName: trimText(input.customerName),
    customerEmail: trimText(input.customerEmail),
    customerPhone: trimText(input.customerPhone),
    orderId: input.orderId,
    subject: trimText(input.subject),
    message: trimText(input.message),
    category: input.category,
    priority: input.priority ?? "medium",
    status: "open",
    source: input.source ?? "chatbot",
    chatEntries: [initialEntry],
    responses: [],
    adminSeenAt: null,
    customerSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const messages = await readSupportMessages();
  messages.push(message);
  await writeSupportMessages(messages);

  return message;
}

export async function appendCustomerSupportMessage(
  conversationId: string,
  input: {
    customerId?: string;
    customerToken?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    message: string;
    attachments?: string[];
    source?: "chatbot" | "email";
  }
) {
  const messages = await readSupportMessages();
  const conversation = messages.find((message) => message.id === conversationId);

  if (!conversation) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  if (!matchesCustomer(conversation, input)) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const updatedConversation: SupportMessage = {
    ...conversation,
    customerName: trimText(input.customerName) || conversation.customerName,
    customerEmail: trimText(input.customerEmail) || conversation.customerEmail,
    customerPhone: trimText(input.customerPhone) || conversation.customerPhone,
    message: trimText(input.message),
    source: input.source ?? conversation.source,
    status: "open",
    chatEntries: [
      ...conversation.chatEntries,
      buildChatEntry({
        sender: "customer",
        senderName: trimText(input.customerName) || conversation.customerName,
        message: input.message,
        attachments: input.attachments,
      }),
    ],
    adminSeenAt: null,
    customerSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeSupportMessages(
    messages.map((message) => (message.id === conversationId ? updatedConversation : message))
  );

  return updatedConversation;
}

export async function markSupportConversationSeenByCustomer(input: {
  conversationId: string;
  customerId?: string;
  customerToken?: string;
}) {
  const messages = await readSupportMessages();
  const conversation = messages.find((message) => message.id === input.conversationId);

  if (!conversation || !matchesCustomer(conversation, input)) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const updatedConversation: SupportMessage = {
    ...conversation,
    customerSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeSupportMessages(
    messages.map((message) => (message.id === input.conversationId ? updatedConversation : message))
  );

  return updatedConversation;
}

export async function addSupportResponse(
  messageId: string,
  input: {
    respondedBy: string;
    respondedByName: string;
    message: string;
    attachments?: string[];
  }
) {
  const messages = await readSupportMessages();
  const message = messages.find((item) => item.id === messageId);

  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const response: SupportResponse = {
    id: randomUUID(),
    respondedBy: input.respondedBy,
    respondedByName: trimText(input.respondedByName),
    message: trimText(input.message),
    attachments: input.attachments,
    createdAt: new Date().toISOString(),
  };

  const updatedMessage: SupportMessage = {
    ...message,
    status: message.status === "resolved" ? "resolved" : "in_progress",
    responses: [...message.responses, response],
    chatEntries: [
      ...message.chatEntries,
      buildChatEntry({
        sender: "support",
        senderName: input.respondedByName,
        message: input.message,
        attachments: input.attachments,
        createdAt: response.createdAt,
      }),
    ],
    customerSeenAt: null,
    updatedAt: response.createdAt,
  };

  await writeSupportMessages(
    messages.map((item) => (item.id === messageId ? updatedMessage : item))
  );

  if (updatedMessage.customerId && !updatedMessage.customerId.startsWith("support-")) {
    await createCustomerNotification({
      userId: updatedMessage.customerId,
      orderId: updatedMessage.orderId ?? null,
      type: "support_reply",
      title: "Soporte respondio",
      message: trimText(input.message) || "Soporte agrego una nueva respuesta en tu conversacion.",
    }).catch((error) => {
      console.error("[support] no se pudo crear la notificacion para el cliente:", error);
    });
  }

  return updatedMessage;
}

export async function updateSupportMessageStatus(
  messageId: string,
  status: "open" | "in_progress" | "resolved"
) {
  const messages = await readSupportMessages();
  const message = messages.find((item) => item.id === messageId);

  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const updatedMessage: SupportMessage = {
    ...message,
    status,
    updatedAt: new Date().toISOString(),
    resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
  };

  await writeSupportMessages(
    messages.map((item) => (item.id === messageId ? updatedMessage : item))
  );

  return updatedMessage;
}

export async function updateSupportMessagePriority(
  messageId: string,
  priority: "low" | "medium" | "high"
) {
  const messages = await readSupportMessages();
  const message = messages.find((item) => item.id === messageId);

  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const updatedMessage: SupportMessage = {
    ...message,
    priority,
    updatedAt: new Date().toISOString(),
  };

  await writeSupportMessages(
    messages.map((item) => (item.id === messageId ? updatedMessage : item))
  );

  return updatedMessage;
}

export async function markSupportMessageSeenByAdmin(messageId: string) {
  const messages = await readSupportMessages();
  const message = messages.find((item) => item.id === messageId);

  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const updatedMessage: SupportMessage = {
    ...message,
    adminSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeSupportMessages(
    messages.map((item) => (item.id === messageId ? updatedMessage : item))
  );

  return updatedMessage;
}

export async function getPendingSupportMessages() {
  const messages = await readSupportMessages();
  return messages.filter((message) => message.status === "open" || message.status === "in_progress");
}

export async function getUnreadSupportMessagesForAdmin() {
  const messages = await readSupportMessages();

  return messages.filter((message) => {
    const lastCustomerEntry = getLastChatEntry(message, "customer");

    if (!lastCustomerEntry) {
      return false;
    }

    if (!message.adminSeenAt) {
      return true;
    }

    return new Date(lastCustomerEntry.createdAt).getTime() > new Date(message.adminSeenAt).getTime();
  });
}

export async function getHighPrioritySupportMessages() {
  const messages = await readSupportMessages();
  return messages.filter((message) => message.priority === "high" && message.status !== "resolved");
}
