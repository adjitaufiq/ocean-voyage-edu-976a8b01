import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { getAiSessionState } from "@/lib/ai-session.functions";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Props = {
  source: "section" | "floating";
  /** Renders the sticky close control in the header (used by the mobile overlay). */
  onClose?: () => void;
  /** Fills the available height instead of using a fixed chat height. */
  fill?: boolean;
  compact?: boolean;
};

const SUGGESTIONS = [
  "Saya butuh website untuk bisnis saya",
  "Operasional saya masih manual, bisa dibantu?",
  "Saya ingin dashboard & laporan otomatis",
  "Bisa integrasi AI ke sistem saya?",
];

const GREETING: UIMessage = {
  id: "greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Halo! Saya AI Consultant KERJAKU. Ceritakan sedikit soal bisnis Anda — bidangnya apa dan kendala apa yang paling terasa saat ini?",
    },
  ],
};

const SESSION_KEY = "kerjaku_ai_session_id";

function makeSessionId() {
  return `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function readStoredSessionId() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeSessionId(id: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}

export function AiConsultantChat({ source, onClose, fill = false, compact = false }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [started, setStarted] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [askResume, setAskResume] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const existing = readStoredSessionId();
    if (!existing) {
      const next = makeSessionId();
      storeSessionId(next);
      setSessionId(next);
      return;
    }
    setSessionId(existing);
    void getAiSessionState({ data: { sessionId: existing } })
      .then((state) => {
        if (!cancelled && state.resumable) setAskResume(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: `kerjaku-consultant-${chatKey}`,
    messages: [GREETING],
    transport: new DefaultChatTransport({
      api: "/api/public/consultant-chat",
      body: () => ({ sessionId }),
    }),
    onError: (err) => toast.error(err.message || "AI Consultant sedang tidak tersedia."),
  });


  const busy = status === "submitted" || status === "streaming";
  const locked = busy || askResume;

  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    for (const message of messages) {
      for (const part of message.parts ?? []) {
        const anyPart = part as { type: string; state?: string; output?: unknown };
        if (anyPart.type === "tool-qualify_conversation" && anyPart.state === "output-available") {
          const output = anyPart.output as {
            packageName?: string;
            businessCategory?: string;
            complexity?: "Low" | "Medium" | "High";
            score?: number;
          };
          trackedRef.current = true;
          analytics.aiConsultationComplete({
            recommended_package: output.packageName ?? "",
            business_category: output.businessCategory ?? "",
            complexity: output.complexity ?? "Medium",
            ai_score: output.score ?? 0,
            qualification:
              (output.score ?? 0) >= 70
                ? "Hot Lead"
                : (output.score ?? 0) >= 40
                  ? "Warm Lead"
                  : "Cold Lead",
          });
        }
      }
    }
  }, [messages]);

  // Only the floating overlay (opened by an explicit user action) may steal focus.
  // The homepage section must never call focus(), otherwise the browser scrolls to it on load.
  useEffect(() => {
    if (source !== "floating") return;
    if (!busy) inputRef.current?.focus();
  }, [busy, source]);

  function send(text: string) {
    const value = text.trim();
    if (!value || locked) return;
    if (!started) {
      setStarted(true);
      analytics.aiConsultationStart(source);
    }
    void sendMessage({ text: value });
  }

  function submit(message: PromptInputMessage) {
    send(message.text ?? "");
  }

  function startFreshSession() {
    const next = makeSessionId();
    storeSessionId(next);
    setSessionId(next);
    trackedRef.current = false;
    setStarted(false);
    setMessages([GREETING]);
    setChatKey((value) => value + 1);
    setAskResume(false);
  }

  function reset() {
    startFreshSession();
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-4", fill && "h-full")}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4.5 w-4.5" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">KERJAKU AI Consultant</p>
          <p className="truncate text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Digital solution advisor
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            aria-label="Mulai percakapan baru"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup AI Consultant"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <X className="h-4.5 w-4.5" strokeWidth={1.5} />
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-primary/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Online
            </span>
          )}
        </div>
      </div>

      {askResume ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-foreground">
            Kami menemukan konsultasi sebelumnya dari perangkat ini.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mau dilanjutkan, atau mulai konsultasi baru untuk project lain?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAskResume(false)}
              className="rounded-full border border-border bg-card/60 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary/50"
            >
              Lanjutkan konsultasi sebelumnya
            </button>
            <button
              type="button"
              onClick={startFreshSession}
              className="rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-xs text-primary transition-colors hover:bg-primary/25"
            >
              Buat konsultasi baru
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-md",
          fill && "flex-1",
        )}
      >
        <Conversation
          className={cn("min-h-0", fill ? "h-full" : compact ? "h-[19rem]" : "h-[26rem]")}
          style={{ overflowY: "auto" }}
        >
          <ConversationContent className="gap-5 p-4">
            {messages.map((message) => {
              const text = (message.parts ?? [])
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              if (!text.trim()) return null;
              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.role === "assistant" ? (
                      <MessageResponse>{text}</MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{text}</p>
                    )}
                  </MessageContent>
                </Message>
              );
            })}
            {busy && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>AI Consultant sedang menganalisa…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {error && (
        <p className="text-xs text-destructive">
          Koneksi AI bermasalah. Coba kirim ulang pesan Anda.
        </p>
      )}

      {messages.length <= 1 && !busy && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-full border border-border bg-card/50 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <PromptInput onSubmit={submit} className="shrink-0">
        <PromptInputTextarea
          ref={inputRef}
          disabled={askResume}
          placeholder={
            askResume
              ? "Pilih lanjutkan atau buat konsultasi baru…"
              : "Tulis pesan untuk AI Consultant…"
          }
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={locked} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
