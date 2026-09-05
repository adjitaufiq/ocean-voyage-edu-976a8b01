import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, generateText, stepCountIs, type UIMessage } from "ai";

import { createAiModel, isAiConfigured } from "@/lib/ai-gateway.server";

type Body = { messages?: unknown; threadId?: unknown };

function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/assistant-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateRequest } = await import("@/lib/assistant-auth.server");
        const auth = await authenticateRequest(request).catch(() => null);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { assertWorkspace } = await import("@/lib/admin.server");
        let role: import("@/lib/admin/roles").WorkspaceRole;
        try {
          role = await assertWorkspace(auth.supabase, auth.userId);
        } catch {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json()) as Body;
        const messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : null;
        const threadId = typeof body.threadId === "string" ? body.threadId : null;
        if (!messages || !threadId) return new Response("Bad request", { status: 400 });

        const { data: thread } = await auth.supabase
          .from("assistant_threads")
          .select("id, title, created_by")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread || thread.created_by !== auth.userId) {
          return new Response("Thread not found", { status: 404 });
        }

        if (!isAiConfigured()) return new Response("AI not configured", { status: 500 });

        const assistant = await import("@/lib/assistant.server");
        const [memoryContext, businessSnapshot] = await Promise.all([
          assistant.buildMemoryContext(auth.supabase, threadId),
          assistant.buildBusinessSnapshot(auth.supabase),
        ]);
        const { ASSISTANT_ACTION_GUIDE, buildAssistantTools } =
          await import("@/lib/assistant-tools.server");
        const system = [
          assistant.buildSystemPrompt(memoryContext, businessSnapshot),
          "",
          ASSISTANT_ACTION_GUIDE,
        ].join("\n");

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const question = lastUser ? textOf(lastUser) : "";
        if (question) {
          await assistant
            .appendMessage(auth.supabase, {
              threadId,
              role: "user",
              content: question,
              userId: auth.userId,
            })
            .catch((error: unknown) => console.error("[assistant] save user message", error));
        }

        const model = createAiModel("AI_ASSISTANT");

        const result = streamText({
          model,
          system,
          tools: buildAssistantTools({
            supabase: auth.supabase,
            userId: auth.userId,
            role,
            threadId,
            origin: "web",
          }),
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            const answer = textOf(responseMessage as UIMessage);
            if (!answer) return;
            try {
              await assistant.appendMessage(auth.supabase, {
                threadId,
                role: "assistant",
                content: answer,
                userId: auth.userId,
              });

              if (!thread.title || thread.title === "Percakapan baru") {
                const title = question.replace(/\s+/g, " ").slice(0, 70);
                if (title) await assistant.renameThread(auth.supabase, threadId, title);
              }

              // Extract durable business memory from this exchange.
              const { text } = await generateText({
                model,
                system:
                  "Ekstrak informasi jangka panjang dari percakapan berikut untuk disimpan sebagai memory asisten bisnis. " +
                  'Balas HANYA JSON: {"memories":[{"category":"business|sales|project|operational","provenance":"user_confirmed_fact|user_preference|assistant_recommendation|hypothesis","title":"...","content":"...","importance":1-5}]}. ' +
                  "provenance WAJIB: user_confirmed_fact hanya bila user menyatakan/mengonfirmasi fakta itu sendiri; user_preference untuk preferensi user; assistant_recommendation untuk saran asisten; hypothesis untuk dugaan yang belum diverifikasi. Kesimpulan AI DILARANG ditandai sebagai fakta. " +
                  "Kategori: business = info perusahaan, layanan, paket, strategi harga, keputusan bisnis. sales = lead penting, diskusi pelanggan, strategi sales. project = diskusi project, preferensi klien, keputusan, kendala. operational = workflow tim, aturan automation, rekomendasi yang diberikan. " +
                  'Simpan maksimal 3 memory, hanya yang benar-benar layak diingat lama (keputusan, preferensi, strategi, rekomendasi). Jika tidak ada, balas {"memories":[]}.',
                prompt: `PERTANYAAN USER:\n${question}\n\nJAWABAN ASISTEN:\n${answer}`,
              });

              const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
                memories?: Array<{
                  category?: string;
                  provenance?: string;
                  title?: string;
                  content?: string;
                  importance?: number;
                }>;
              };
              const { isMemoryCategory, clampAiProvenance } = await import(
                "@/lib/assistant/memory"
              );
              for (const item of (parsed.memories ?? []).slice(0, 3)) {
                if (!item.title || !item.content || !isMemoryCategory(item.category)) continue;
                await assistant.saveMemory(
                  auth.supabase,
                  {
                    category: item.category,
                    title: item.title,
                    content: item.content,
                    importance: item.importance,
                    // AI extraction can never mint a database-level fact.
                    provenance: clampAiProvenance(item.provenance),
                    sourceThreadId: threadId,
                  },
                  auth.userId,
                );
              }
            } catch (error) {
              console.error("[assistant] finish handler", error);
            }
          },
        });
      },
    },
  },
});
