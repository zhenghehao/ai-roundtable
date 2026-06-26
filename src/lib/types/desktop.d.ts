import type {
  KnowledgeBaseListRequest,
  KnowledgeBaseListResult,
  KnowledgeBaseSearchRequest,
  KnowledgeBaseSearchResult,
  KnowledgeBaseSelectionReadRequest,
  LocalAgentDetection,
  LocalAgentDetectionRequest,
  LocalAgentModelCatalog,
  LocalAgentModelRequest,
  ModelInput,
  ModelResponse
} from "@/lib/types";

declare global {
  interface Window {
    roundtableDesktop?: {
      callModel: (input: Omit<ModelInput, "signal"> & { requestId: string }) => Promise<ModelResponse>;
      cancelModelCall: (requestId: string) => Promise<boolean>;
      detectLocalAgents: (requests: LocalAgentDetectionRequest[]) => Promise<LocalAgentDetection[]>;
      listLocalAgentModels: (requests: LocalAgentModelRequest[]) => Promise<LocalAgentModelCatalog[]>;
      selectKnowledgeBaseVault: () => Promise<string | undefined>;
      searchKnowledgeBase: (request: KnowledgeBaseSearchRequest) => Promise<KnowledgeBaseSearchResult>;
      listKnowledgeBaseEntries: (request: KnowledgeBaseListRequest) => Promise<KnowledgeBaseListResult>;
      readKnowledgeBaseSelection: (request: KnowledgeBaseSelectionReadRequest) => Promise<KnowledgeBaseSearchResult>;
    };
  }
}

export {};
