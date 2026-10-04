import { Sidebar } from "@/components/Sidebar";
import { navItems } from "@/lib/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const items = await navItems();
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink">
      <Sidebar items={items} />
      <main
        className="box-border flex min-w-0 flex-col gap-5 px-8 pb-10 pt-6 max-[520px]:px-4"
        style={{ flex: "999 1 560px" }}
      >
        {children}
      </main>
    </div>
  );
}
