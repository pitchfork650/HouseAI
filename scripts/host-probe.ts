/** Read-only look at the configured OpenSwarm host: lists its MCP tools and calls `health`. */
import { OpenSwarmHost, validateHostUrl } from "../src/lib/swarm/host/openswarm";

const url = process.env.OPENSWARM_HOST_URL;
if (!url) {
  console.error("Set OPENSWARM_HOST_URL (and OPENSWARM_TOKEN) first.");
  process.exit(1);
}
const host = new OpenSwarmHost(validateHostUrl(url), process.env.OPENSWARM_TOKEN ?? "");
host
  .probe()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error("Probe failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
