import { processFollowUps } from "./followup-actions";
import { processDueLaneRetries } from "./swarm/insurance/run";

/** One scheduler pass: due follow-up emails, day-12 reminders, due insurance-lane retries. */
export async function tick() {
  const followUps = await processFollowUps();
  const laneRetries = await processDueLaneRetries();
  return { ...followUps, laneRetries };
}
