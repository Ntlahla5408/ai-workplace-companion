import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import {
  LayoutDashboard,
  MessageSquare,
  Mail,
  FileText,
  ListChecks,
  Search,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const tools = [
  {
    to: "/chat",
    icon: MessageSquare,
    title: "AI Chat Assistant",
    desc: "Ask anything — get drafts, summaries, ideas.",
    example: "How do I structure a Q3 planning email?",
  },
  {
    to: "/email",
    icon: Mail,
    title: "Smart Email Generator",
    desc: "Draft polished emails in seconds.",
    example: "Decline a vendor meeting politely",
  },
  {
    to: "/meetings",
    icon: FileText,
    title: "Meeting Summarizer",
    desc: "Paste notes — get summary + action items.",
    example: "Weekly engineering sync notes",
  },
  {
    to: "/tasks",
    icon: ListChecks,
    title: "AI Task Planner",
    desc: "Turn a goal into a sequenced plan.",
    example: "Launch internal onboarding portal",
  },
  {
    to: "/research",
    icon: Search,
    title: "Research Assistant",
    desc: "Concise briefings with sources.",
    example: "EU AI Act compliance for SaaS",
  },
] as const;

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [emails, meetings, tasks, research] = await Promise.all([
        supabase.from("emails").select("*", { count: "exact", head: true }),
        supabase.from("meeting_notes").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("status"),
        supabase.from("research_queries").select("*", { count: "exact", head: true }),
      ]);
      const taskRows = tasks.data ?? [];
      return {
        emails: emails.count ?? 0,
        meetings: meetings.count ?? 0,
        research: research.count ?? 0,
        tasksTotal: taskRows.length,
        tasksDone: taskRows.filter((t) => t.status === "done").length,
        tasksOpen: taskRows.filter((t) => t.status !== "done").length,
      };
    },
  });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const firstName = user?.email?.split("@")[0]?.split(".")[0] ?? "there";

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`Good to see you, ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}`}
        description="Your AI-powered workspace overview."
      />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Emails drafted" value={stats?.emails ?? 0} icon={Mail} />
          <StatCard label="Meetings summarized" value={stats?.meetings ?? 0} icon={FileText} />
          <StatCard
            label="Open tasks"
            value={stats?.tasksOpen ?? 0}
            icon={Clock}
            sub={`${stats?.tasksDone ?? 0} completed`}
          />
          <StatCard label="Research briefings" value={stats?.research ?? 0} icon={Search} />
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Jump back in
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((t, i) => (
              <motion.div
                key={t.to}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link to={t.to} className="group block">
                  <Card className="h-full rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <t.icon className="h-5 w-5" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{t.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                    <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      Try: "{t.example}"
                    </p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Pro tip</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the Task Planner to break a quarterly goal into a sequenced plan, then route the
                weekly check-ins through the Meeting Summarizer to track follow-ups automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card className="rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
