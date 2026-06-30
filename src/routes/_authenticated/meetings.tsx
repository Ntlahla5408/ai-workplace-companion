import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { summarizeMeeting } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles, Loader2, CheckCircle2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/meetings")({
  component: MeetingsPage,
});

type ActionItem = { owner: string; task: string; due: string | null };
type Note = {
  id: string;
  title: string;
  summary: string | null;
  key_decisions: string[];
  action_items: ActionItem[];
  created_at: string;
};

const SAMPLE = `Q3 Roadmap sync · 30 min

Attendees: Maya (PM), Devon (Eng lead), Priya (Design), Marco (QA)

- Maya walked through revised roadmap; we're pushing the analytics dashboard from Aug to Sep to make room for the SSO work enterprise prospects keep asking about.
- Devon flagged that the SSO discovery doc isn't finalized; needs Priya for UX of the admin invite flow by Friday.
- Marco said current automated test coverage on billing flows is ~60%; he'll bring it to 80% before the Sep release.
- Decision: ship SSO MVP (Google + Okta) in Aug; SAML support deferred to Q4.
- Maya will share updated milestones in Notion by EOD tomorrow.`;

function MeetingsPage() {
  const qc = useQueryClient();
  const summarize = useServerFn(summarizeMeeting);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState<Note | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as Note[];
    },
  });

  const mutation = useMutation({
    mutationFn: () => summarize({ data: { title, rawNotes: notes } }),
    onSuccess: (row) => {
      setActive(row as unknown as Note);
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Meeting summarized");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Meeting Notes Summarizer"
        description="Paste rough notes — get a clean summary, decisions, and action items."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Notes</h2>
            <button
              type="button"
              onClick={() => {
                setTitle("Q3 Roadmap sync");
                setNotes(SAMPLE);
              }}
              className="text-xs text-primary hover:underline"
            >
              Try a sample
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="t">Meeting title</Label>
              <Input
                id="t"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly product sync"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="n">Raw notes or transcript</Label>
              <Textarea
                id="n"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your meeting notes, bullets, or transcript…"
                rows={14}
                className="mt-1.5 resize-none font-mono text-xs leading-relaxed"
              />
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || notes.length < 20 || !title}
              className="w-full"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Summarize
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          {!active ? (
            <Card className="rounded-2xl p-6">
              <h2 className="text-base font-semibold">Summary</h2>
              <div className="mt-6 grid place-items-center rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                Your meeting summary will appear here.
              </div>
            </Card>
          ) : (
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="rounded-2xl p-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                <h2 className="mt-1 text-lg font-semibold">{active.title}</h2>
                <p className="mt-3 text-sm leading-relaxed">{active.summary}</p>

                {active.key_decisions?.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Lightbulb className="h-4 w-4 text-primary" /> Key decisions
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {active.key_decisions.map((d, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary">•</span> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {active.action_items?.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Action items
                    </div>
                    <ul className="mt-3 space-y-2">
                      {active.action_items.map((a, i) => (
                        <li
                          key={i}
                          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{a.owner}</span>
                            {a.due && (
                              <span className="text-xs text-muted-foreground">Due {a.due}</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{a.task}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {history.length > 0 && (
            <Card className="rounded-2xl p-6">
              <h2 className="text-base font-semibold">History</h2>
              <ul className="mt-3 divide-y">
                {history.map((m) => (
                  <li key={m.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setActive(m)}
                      className="block w-full text-left"
                    >
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })} ·{" "}
                        {m.action_items?.length ?? 0} action items
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
