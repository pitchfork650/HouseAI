import { Sidebar } from "@/components/Sidebar";
import { navItems } from "@/lib/nav";
import { swarmHost } from "@/lib/swarm/host";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [items, host] = await Promise.all([navItems(), swarmHost().status()]);
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink">
      <Sidebar items={items} host={{ connected: host.connected, label: host.connected ? "OpenSwarm · connected" : host.kind === "mock" ? "OpenSwarm · mock" : `OpenSwarm · ${host.label.replace("Host ", "")}`, detail: host.detail }} />
      <main
        className="box-border flex min-w-0 flex-col gap-5 px-8 pb-10 pt-6 max-[520px]:px-4"
        style={{ flex: "999 1 560px" }}
      >
        {children}
      </main>
    </div>
  );
}
