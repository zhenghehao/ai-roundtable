import type {
  LocalAgentDetection,
  LocalAgentDetectionRequest,
  ModelInput,
  ModelResponse
} from "@/lib/types";

declare global {
  interface Window {
    roundtableDesktop?: {
      callModel: (input: Omit<ModelInput, "signal"> & { requestId: string }) => Promise<ModelResponse>;
      cancelModelCall: (requestId: string) => Promise<boolean>;
      detectLocalAgents: (requests: LocalAgentDetectionRequest[]) => Promise<LocalAgentDetection[]>;
    };
  }
}

export {};
