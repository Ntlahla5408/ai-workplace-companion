import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, LogOut, Shield, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = (form.elements.namedItem("pw") as HTMLInputElement).value;
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      form.reset();
    }
  }

  return (
    <div>
      <PageHeader
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        description="Manage your account and workspace preferences."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card className="rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Account</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-0.5 font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">User ID</dt>
              <dd className="mt-0.5 truncate font-mono text-xs">{user?.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Joined</dt>
              <dd className="mt-0.5">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Security</h2>
          </div>
          <form onSubmit={changePassword} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                name="pw"
                type="password"
                minLength={6}
                placeholder="At least 6 characters"
                className="mt-1.5"
              />
            </div>
            <Button type="submit" variant="outline">
              Update password
            </Button>
          </form>
        </Card>

        <Card className="rounded-2xl p-6">
          <h2 className="text-base font-semibold">Preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace-wide preferences for the assistant.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <PrefRow label="Default email tone" value="Professional" />
            <PrefRow label="AI model" value="Gemini 3 Flash · fast" />
            <PrefRow label="Time zone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          </div>
        </Card>

        <Card className="rounded-2xl border-destructive/20 p-6">
          <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out of this workspace on this device.
          </p>
          <Button variant="destructive" className="mt-4" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
