import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const MODEL = "google/gemini-3-flash-preview";

function gateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key)(MODEL);
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const startA = raw.indexOf("[");
  const i =
    start === -1 ? startA : startA === -1 ? start : Math.min(start, startA);
  const slice = i >= 0 ? raw.slice(i) : raw;
  return JSON.parse(slice) as T;
}

/* ---------------- Chat ---------------- */

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ threadId: z.string().uuid(), message: z.string().min(1).max(8000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify thread ownership
    const { data: thread, error: tErr } = await supabase
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .single();
    if (tErr || !thread) throw new Error("Thread not found");

    // Insert user message
    const { error: insErr } = await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.message,
    });
    if (insErr) throw new Error(insErr.message);

    // Fetch history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(50);

    const messages = [
      {
        role: "system" as const,
        content:
          "You are the AI Productivity Assistant — a friendly, concise expert helping employees automate workplace tasks like drafting emails, summarizing meetings, planning projects, and quick research. Use markdown when helpful. Keep answers practical and skimmable.",
      },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const { text } = await generateText({ model: gateway(), messages });

    await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      content: text,
    });

    // Auto-title new threads
    if (thread.title === "New conversation") {
      const title = data.message.slice(0, 60);
      await supabase
        .from("chat_threads")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    } else {
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    }

    return { reply: text };
  });

/* ---------------- Email ---------------- */

export const generateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipient: z.string().max(200).optional(),
        context: z.string().min(3).max(4000),
        tone: z.enum(["professional", "friendly", "concise", "persuasive", "apologetic"]),
        save: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const prompt = `Write a workplace email.
Recipient: ${data.recipient || "(unspecified)"}
Tone: ${data.tone}
Context / what to say: ${data.context}

Return ONLY valid JSON: {"subject": string, "body": string}.
The body should be ready-to-send, well-structured, with greeting and sign-off.`;

    const { text } = await generateText({ model: gateway(), prompt });
    const parsed = extractJson<{ subject: string; body: string }>(text);

    if (data.save) {
      await context.supabase.from("emails").insert({
        user_id: context.userId,
        recipient: data.recipient ?? null,
        subject: parsed.subject,
        body: parsed.body,
        tone: data.tone,
        context: data.context,
      });
    }
    return parsed;
  });

/* ---------------- Meeting summarizer ---------------- */

export const summarizeMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        rawNotes: z.string().min(20).max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const prompt = `You are summarizing a workplace meeting. Given the raw notes below, produce a clean structured output.

Notes:
"""
${data.rawNotes}
"""

Return ONLY valid JSON:
{
  "summary": "2-4 sentence executive summary",
  "key_decisions": ["..."],
  "action_items": [{"owner": "Name or 'Unassigned'", "task": "...", "due": "ISO date or null"}]
}`;

    const { text } = await generateText({ model: gateway(), prompt });
    const parsed = extractJson<{
      summary: string;
      key_decisions: string[];
      action_items: Array<{ owner: string; task: string; due: string | null }>;
    }>(text);

    const { data: row, error } = await context.supabase
      .from("meeting_notes")
      .insert({
        user_id: context.userId,
        title: data.title,
        raw_notes: data.rawNotes,
        summary: parsed.summary,
        key_decisions: parsed.key_decisions,
        action_items: parsed.action_items,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ---------------- Task planner ---------------- */

export const planTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        goal: z.string().min(3).max(2000),
        deadlineDays: z.number().int().min(1).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const today = new Date();
    const prompt = `Break this workplace goal into 4-8 concrete tasks an employee can execute.

Goal: ${data.goal}
${data.deadlineDays ? `Total timeframe: ${data.deadlineDays} days from today (${today.toISOString().slice(0, 10)}).` : ""}

Return ONLY valid JSON array of tasks:
[
  {"title": "...", "description": "...", "priority": "low|medium|high", "estimated_minutes": number, "due_offset_days": number}
]
Order by execution sequence. Use realistic priorities and time estimates.`;

    const { text } = await generateText({ model: gateway(), prompt });
    const tasks = extractJson<
      Array<{
        title: string;
        description: string;
        priority: "low" | "medium" | "high";
        estimated_minutes: number;
        due_offset_days: number;
      }>
    >(text);

    const rows = tasks.map((t) => {
      const due = new Date(today);
      due.setDate(due.getDate() + (t.due_offset_days ?? 1));
      return {
        user_id: context.userId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        estimated_minutes: t.estimated_minutes,
        due_date: due.toISOString().slice(0, 10),
        ai_generated: true,
        status: "todo" as const,
      };
    });

    const { data: inserted, error } = await context.supabase
      .from("tasks")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return inserted;
  });

/* ---------------- Research assistant ---------------- */

export const runResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(3).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const prompt = `You are an AI research assistant. The user asks:
"${data.query}"

Produce a concise research briefing grounded in widely-known facts. If something is uncertain, say so.

Return ONLY valid JSON:
{
  "summary": "3-5 sentence overview",
  "key_points": ["..."],
  "sources": [{"title": "...", "url": "https://...", "note": "what this source covers"}]
}
Use plausible reputable source domains (e.g. official docs, Wikipedia, major publications). Do not invent specific article URLs you are not sure exist — prefer homepages or well-known canonical URLs.`;

    const { text } = await generateText({ model: gateway(), prompt });
    const parsed = extractJson<{
      summary: string;
      key_points: string[];
      sources: Array<{ title: string; url: string; note: string }>;
    }>(text);

    const { data: row, error } = await context.supabase
      .from("research_queries")
      .insert({
        user_id: context.userId,
        query: data.query,
        summary: parsed.summary,
        key_points: parsed.key_points,
        sources: parsed.sources,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
