import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PendingActionsPanel } from "@/components/admin/PendingActionsPanel";
import { supabase } from "@/integrations/supabase/client";
import type { AssistantStoredMessage } from "@/lib/assistant/memory";

const SUGGESTIONS = [
  "Ringkas kondisi bisnis KERJAKU minggu ini",
  "Lead mana yang harus di-follow up hari ini?",
  "Bagaimana progress project yang sedang berjalan?",
  "Lanjutkan pembahasan strategi paket kita",
];

function toUiMessages(rows: AssistantStoredMessage[]): UIMessage[] {
  return rows
    .filter((row) => row.role !== "system")
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: row.content }],
    }));
}

export function AssistantChat({
  threadId,
  initialMessages,
  onExchange,
}: {
  threadId: string;
  initialMessages: AssistantStoredMessage[];
  onExchange?: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [actionsKey, setActionsKey] = useState(0);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: toUiMessages(initialMessages),
    transport: new DefaultChatTransport({
      api: "/api/assistant-chat",
      body: { threadId },
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onFinish: () => {
      onExchange?.();
      setActionsKey((value) => value + 1);
    },
    onError: (err) => toast.error(err.message || "AI assistant sedang tidak tersedia."),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  function submit(message: PromptInputMessage) {
    const text = (message.text ?? "").trim();
    if (!text || busy) return;
    void sendMessage({ text });
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[28rem] flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="AI Business Assistant"
              description="Asisten bisnis jangka panjang KERJAKU — mengingat percakapan, keputusan, dan rekomendasi sebelumnya."
            >
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage({ text: s })}
                    className="rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : null}

          {messages.map((message) => {
            const text = message.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("");
            const actions = message.parts
              .filter((part) => part.type.startsWith("tool-"))
              .map((part) => part.type.replace("tool-", "").replace(/_/g, " "));
            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageResponse>{text}</MessageResponse>
                  {actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {actions.map((action, index) => (
                        <span
                          key={`${action}-${index}`}
                          className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-primary"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </MessageContent>
              </Message>
            );
          })}


          {status === "submitted" ? (
            <Shimmer className="text-sm">Menganalisis konteks bisnis…</Shimmer>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive">
              {error.message || "Terjadi kesalahan saat menghubungi AI."}
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PendingActionsPanel refreshKey={actionsKey} />

      <PromptInput className="mt-4" onSubmit={submit}>
        <PromptInputTextarea
          ref={inputRef}
          autoFocus
          placeholder="Tanya apa saja — misalnya “bagaimana yang kemarin?”"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={busy} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
