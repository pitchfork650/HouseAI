/** Re-mounts on every navigation, so each screen eases in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="rise flex min-w-0 flex-col gap-5">{children}</div>;
}
