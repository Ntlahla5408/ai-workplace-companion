import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { planTasks } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ListChecks, Sparkles, Loader2, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

const priorityStyle: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-accent/10 text-accent",
  low: "bg-muted text-muted-foreground",
};

function TasksPage() {
  const qc = useQueryClient();
  const plan = useServerFn(planTasks);
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState(14);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("status", { ascending: true })
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => plan({ data: { goal, deadlineDays: days } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setGoal("");
      toast.success("Plan generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const next = status === "done" ? "todo" : "done";
      const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <PageHeader
        icon={<ListChecks className="h-5 w-5" />}
        title="AI Task Planner"
        description="Describe a goal — get a sequenced plan with priorities and time estimates."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-2xl p-6 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-base font-semibold">Plan a project</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="g">Goal</Label>
              <Textarea
                id="g"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Launch a new internal onboarding portal for engineers"
                rows={4}
                className="mt-1.5 resize-none"
              />
            </div>
            <div>
              <Label htmlFor="d">Timeframe (days)</Label>
              <Input
                id="d"
                type="number"
                min={1}
                max={180}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || goal.length < 5}
              className="w-full"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate plan
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Open · {open.length}</h2>
            </div>
            <ul className="mt-4 space-y-2">
              <AnimatePresence>
                {open.map((t) => (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex items-start gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/30"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggle.mutate({ id: t.id, status: t.status })}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyle[t.priority]}`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {t.due_date && <span>Due {t.due_date}</span>}
                        {t.estimated_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {t.estimated_minutes} min
                          </span>
                        )}
                        {t.ai_generated && (
                          <span className="flex items-center gap-1 text-primary">
                            <Sparkles className="h-3 w-3" /> AI
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => remove.mutate(t.id)}
                      className="rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {open.length === 0 && (
                <li className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  Nothing on your plate. Generate a plan to get started.
                </li>
              )}
            </ul>
          </Card>

          {done.length > 0 && (
            <Card className="rounded-2xl p-6">
              <h2 className="text-base font-semibold">Completed · {done.length}</h2>
              <ul className="mt-4 space-y-2">
                {done.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3"
                  >
                    <Checkbox
                      checked
                      onCheckedChange={() => toggle.mutate({ id: t.id, status: t.status })}
                    />
                    <p className="flex-1 text-sm text-muted-foreground line-through">{t.title}</p>
                    <button
                      onClick={() => remove.mutate(t.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
