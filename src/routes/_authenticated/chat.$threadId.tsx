import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendChatMessage } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThread,
});

const SUGGESTIONS = [
  "Draft a Slack message announcing our new vacation policy",
  "Summarize this Q3 sales report into 3 bullets",
  "Help me prepare for a 1:1 with my manager about workload",
  "Outline an onboarding checklist for a new product designer",
];

function ChatThread() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const send = useServerFn(sendChatMessage);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (message: string) => send({ data: { threadId, message } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", threadId] });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, mutation.isPending]);

  function submit(text?: string) {
    const v = (text ?? input).trim();
    if (!v || mutation.isPending) return;
    setInput("");
    mutation.mutate(v);
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 && !mutation.isPending && (
            <div className="py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">How can I help today?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask anything — work emails, planning, summaries, or analysis.
              </p>
              <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-xl border bg-card p-3 text-left text-sm transition hover:border-primary/40 hover:bg-muted/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {mutation.isPending && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1 pt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t bg-card/60 backdrop-blur">
        <form
          className="mx-auto max-w-3xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the assistant…"
              rows={1}
              className="min-h-10 max-h-48 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={mutation.isPending || !input.trim()}
              className="shrink-0"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Press Enter to send · Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3"
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          {isUser ? "You" : "Assistant"}
        </p>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:bg-muted prose-code:text-foreground prose-headings:mt-4 prose-headings:mb-2">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}
