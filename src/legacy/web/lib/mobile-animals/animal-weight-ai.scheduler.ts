import { processAnimalWeightAiJob } from "./animal-weight-ai.processor.js";

export function scheduleAnimalWeightAiJob(jobId: string): void {
  setImmediate(() => {
    void processAnimalWeightAiJob(jobId).catch(() => {
      // errors persisted on job row
    });
  });
}
