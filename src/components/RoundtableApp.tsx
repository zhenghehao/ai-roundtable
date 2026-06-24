"use client";

import { useEffect, useRef, useState } from "react";
import { Circle } from "lucide-react";
import { ChatView } from "@/components/chat/ChatView";
import { NewRoomDialog } from "@/components/chat/NewRoomDialog";
import { HistoryView } from "@/components/history/HistoryView";
import { ProvidersView } from "@/components/providers/ProvidersView";
import { RolesView } from "@/components/roles/RolesView";
import { SettingsView } from "@/components/settings/SettingsView";
import { type AppView, Sidebar } from "@/components/Sidebar";
import { I18nProvider } from "@/lib/i18n-context";
import { createTranslator } from "@/lib/i18n";
import {
  buildContextCompressionMessages,
  buildContextCompressionSystemPrompt,
  buildDeterministicContextDigest,
  buildRoundtableContextMessages,
  buildRoleSystemPrompt,
  buildSummarySystemPrompt,
  chunkMessagesForContextCompression,
  createRoomContextMemory,
  detectRoleBoundaryViolation,
  getDiscussionTaskKind,
  getMentionedDiscussionPlan,
  getSummaryRole,
  planContextCompression,
  type RoleExecutionContext
} from "@/lib/chat";
import { buildConnectionTestReport, callModel, toFriendlyError } from "@/lib/model-adapters";
import { createDefaultAppState } from "@/lib/defaults";
import {
  loadAppState,
  parseImportedMessages,
  resetAppState,
  saveAppState,
  serializeRoomAsJson,
  serializeRoomAsMarkdown,
  serializeRoomAsText
} from "@/lib/storage/app-storage";
import type {
  AgentRole,
  AppState,
  ChatAttachment,
  ChatMessage,
  ChatRoom,
  KnowledgeBaseSearchResult,
  LocalAgentDetection,
  LocalAgentDetectionRequest,
  LocalAgentModelCatalog,
  LocalAgentModelRequest,
  ModelMessage,
  ProviderConfig,
  RoomContextMemory,
  RoomMode,
  ThemeMode
} from "@/lib/types";
import { copyText, createId, downloadText, nowIso } from "@/lib/utils";

export function RoundtableApp() {
  const [state, setState] = useState<AppState>(() => createDefaultAppState());
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("chat");
  const [isRunning, setIsRunning] = useState(false);
  const [speakingRoleId, setSpeakingRoleId] = useState<string | undefined>();
  const [testingProviderId, setTestingProviderId] = useState<string | undefined>();
  const [localAgentDetections, setLocalAgentDetections] = useState<LocalAgentDetection[]>([]);
  const [localAgentModelCatalogs, setLocalAgentModelCatalogs] = useState<LocalAgentModelCatalog[]>([]);
  const [detectingLocalAgents, setDetectingLocalAgents] = useState(false);
  const [notice, setNotice] = useState("");
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [newRoomMode, setNewRoomMode] = useState<RoomMode>("group");
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [showOpening, setShowOpening] = useState(true);
  const stateRef = useRef(state);
  const abortRef = useRef<AbortController | null>(null);
  const localAgentSignature = state.providers
    .filter((provider) => provider.localCli)
    .map(
      (provider) =>
        `${provider.id}:${provider.protocol}:${provider.baseUrl}:${provider.defaultModel}:${provider.localCli?.agentId}:${provider.localCli?.commandCandidates.join("|")}:${provider.localCli?.detectionPaths?.join("|") || ""}:${provider.localCli?.args.join("|") || ""}`
    )
    .join(",");

  const detectLocalAgents = async (providers = stateRef.current.providers) => {
    const detectionRequests: LocalAgentDetectionRequest[] = providers
      .filter((provider) => provider.localCli)
      .map((provider) => ({
        id: provider.id,
        agentId: provider.localCli?.agentId,
        commandCandidates: provider.localCli?.commandCandidates || [],
        detectionPaths: provider.localCli?.detectionPaths || [],
        baseUrl: provider.baseUrl
      }));
    const modelRequests: LocalAgentModelRequest[] = providers
      .filter((provider) => provider.localCli)
      .map((provider) => ({
        id: provider.id,
        agentId: provider.localCli?.agentId || "",
        commandCandidates: provider.localCli?.commandCandidates || [],
        configuredModel: provider.defaultModel,
        args: provider.localCli?.args || [],
        baseUrl: provider.baseUrl
      }));

    if (!window.roundtableDesktop?.detectLocalAgents || !window.roundtableDesktop?.listLocalAgentModels) {
      setLocalAgentDetections([]);
      setLocalAgentModelCatalogs([]);
      return;
    }

    setDetectingLocalAgents(true);
    try {
      const [detections, modelCatalogs] = await Promise.all([
        window.roundtableDesktop.detectLocalAgents(detectionRequests),
        window.roundtableDesktop.listLocalAgentModels(modelRequests)
      ]);
      setLocalAgentDetections(detections);
      setLocalAgentModelCatalogs(modelCatalogs);
    } finally {
      setDetectingLocalAgents(false);
    }
  };

  useEffect(() => {
    setState(loadAppState());
    setIsDesktopApp(Boolean(window.roundtableDesktop));
    setLoaded(true);
    const timer = window.setTimeout(() => setShowOpening(false), 2800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (loaded) {
      saveAppState(state);
    }
  }, [loaded, state]);

  useEffect(() => {
    if (loaded) {
      void detectLocalAgents(state.providers);
    }
  }, [loaded, localAgentSignature]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!loaded) {
    return (
      <div className="startup-screen flex h-screen items-center justify-center px-6 text-center">
        <div>
          <img
            src="./brand/ai-roundtable-logo.png"
            alt="AI圆桌"
            className="brand-logo mx-auto h-auto w-[240px] select-none object-contain"
            draggable={false}
          />
          <p className="page-heading mt-7 text-[19px] font-medium tracking-[-0.03em] text-[var(--ink-soft)]">
            从不同的答案，走向更好的答案
          </p>
          <div className="startup-pulse mx-auto mt-8 h-1 w-16 overflow-hidden rounded-full bg-[var(--line)]">
            <span className="block h-full w-1/2 rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      </div>
    );
  }

  const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId) || state.rooms[0];
  const t = createTranslator(state.settings.language);
  const waitBetweenModelCalls = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("讨论已停止。", "AbortError"));
        return;
      }

      const timer = window.setTimeout(resolve, 2500);
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException("讨论已停止。", "AbortError"));
      };

      signal.addEventListener("abort", onAbort, { once: true });
      window.setTimeout(() => signal.removeEventListener("abort", onAbort), 2600);
    });

  const updateRooms = (updater: (rooms: ChatRoom[]) => ChatRoom[], activeRoomId = stateRef.current.activeRoomId) => {
    setState((current) => ({
      ...current,
      rooms: updater(current.rooms),
      activeRoomId
    }));
  };

  const updateRoom = (room: ChatRoom) => {
    updateRooms((rooms) =>
      rooms.map((item) =>
        item.id === room.id
          ? {
              ...room,
              updatedAt: nowIso()
            }
          : item
      )
    );
  };

  const commitMessages = (roomId: string, messages: ChatMessage[]) => {
    updateRooms((rooms) =>
      rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              messages,
              updatedAt: nowIso()
            }
          : room
      )
    );
  };

  const commitContextMemory = (roomId: string, contextMemory?: RoomContextMemory) => {
    updateRooms((rooms) =>
      rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              contextMemory,
              updatedAt: nowIso()
            }
          : room
      )
    );
  };

  const showNotice = (message: string) => setNotice(message);

  const openNewRoomDialog = (mode: RoomMode) => {
    setNewRoomMode(mode);
    setNewRoomOpen(true);
  };

  const saveProvider = (provider: ProviderConfig) => {
    setState((current) => {
      const exists = current.providers.some((item) => item.id === provider.id);
      return {
        ...current,
        providers: exists
          ? current.providers.map((item) => (item.id === provider.id ? provider : item))
          : [...current.providers, provider]
      };
    });
    showNotice(t("providerSaved"));
  };

  const deleteProvider = (providerId: string) => {
    setState((current) => ({
      ...current,
      providers: current.providers.filter((provider) => provider.id !== providerId),
      roles: current.roles.map((role) => (role.providerId === providerId ? { ...role, providerId: "", updatedAt: nowIso() } : role))
    }));
    showNotice(t("providerDeleted"));
  };

  const updateProviderDefaultModel = (providerId: string, model: string) => {
    setState((current) => {
      const provider = current.providers.find((item) => item.id === providerId);
      const previousDefaultModel = provider?.defaultModel || "";
      const timestamp = nowIso();

      return {
        ...current,
        providers: current.providers.map((item) =>
          item.id === providerId
            ? {
                ...item,
                defaultModel: model,
                updatedAt: timestamp
              }
            : item
        ),
        roles: current.roles.map((role) =>
          role.providerId === providerId && (!role.model || role.model === previousDefaultModel)
            ? {
                ...role,
                model,
                updatedAt: timestamp
              }
            : role
        )
      };
    });
    showNotice(model ? `默认模型已切换为 ${model}` : "已恢复跟随 CLI 默认模型");
  };

  const saveRole = (role: AgentRole) => {
    setState((current) => {
      const exists = current.roles.some((item) => item.id === role.id);
      const roles = exists ? current.roles.map((item) => (item.id === role.id ? role : item)) : [...current.roles, role];
      const rooms = exists
        ? current.rooms
        : current.rooms.map((room) =>
            room.id === current.activeRoomId
              ? { ...room, roleIds: Array.from(new Set([...room.roleIds, role.id])), updatedAt: nowIso() }
              : room
          );

      return {
        ...current,
        roles,
        rooms
      };
    });
    showNotice(t("roleSaved"));
  };

  const updateRoleModel = (roleId: string, model: string) => {
    setState((current) => ({
      ...current,
      roles: current.roles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              model,
              updatedAt: nowIso()
            }
          : role
      )
    }));
    showNotice(model ? `已切换模型：${model}` : "已恢复配置默认模型");
  };

  const deleteRole = (roleId: string) => {
    setState((current) => ({
      ...current,
      roles: current.roles.filter((role) => role.id !== roleId),
      rooms: current.rooms.map((room) => ({
        ...room,
        roleIds: room.roleIds.filter((item) => item !== roleId),
        updatedAt: nowIso()
      }))
    }));
    showNotice(t("roleDeleted"));
  };

  const updateLanguage = (language: AppState["settings"]["language"]) => {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        language
      }
    }));
    showNotice(t("languageSaved"));
  };

  const updateTheme = (theme: ThemeMode) => {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme
      }
    }));
  };

  const updateKnowledgeBase = (knowledgeBase: AppState["settings"]["knowledgeBase"]) => {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        knowledgeBase
      }
    }));
    showNotice(knowledgeBase.enabled ? "知识库检索已开启" : "知识库检索已关闭");
  };

  const selectKnowledgeBaseVault = async () => {
    if (!window.roundtableDesktop?.selectKnowledgeBaseVault) {
      window.alert("读取本地 Obsidian 知识库需要使用 AI圆桌桌面版。");
      return;
    }

    const vaultPath = await window.roundtableDesktop.selectKnowledgeBaseVault();
    if (!vaultPath) {
      return;
    }

    updateKnowledgeBase({
      ...stateRef.current.settings.knowledgeBase,
      enabled: true,
      vaultPath
    });
    showNotice("已选择 Obsidian 知识库");
  };

  const formatKnowledgeSearchResult = (result: KnowledgeBaseSearchResult) => {
    const lines = [
      "# Obsidian 知识库检索结果",
      "",
      `检索词：${result.query || "当前圆桌主题"}`,
      `命中笔记：${result.hits.length} / 已扫描：${result.scannedFileCount}`,
      result.message ? `说明：${result.message}` : "",
      ""
    ].filter(Boolean);

    result.hits.forEach((hit, index) => {
      lines.push(`## ${index + 1}. ${hit.title}`);
      lines.push(`路径：${hit.relativePath}`);
      if (hit.modifiedAt) {
        lines.push(`更新时间：${new Date(hit.modifiedAt).toLocaleString("zh-CN")}`);
      }
      lines.push("");
      lines.push(hit.excerpt);
      lines.push("");
    });

    return lines.join("\n");
  };

  const searchKnowledgeForTopic = async (query: string): Promise<ChatAttachment | undefined> => {
    const knowledgeBase = stateRef.current.settings.knowledgeBase;
    if (!knowledgeBase.enabled || !knowledgeBase.vaultPath) {
      return undefined;
    }

    if (!window.roundtableDesktop?.searchKnowledgeBase) {
      showNotice("桌面版才能读取本地知识库");
      return undefined;
    }

    try {
      showNotice("正在检索 Obsidian 知识库...");
      const result = await window.roundtableDesktop.searchKnowledgeBase({
        vaultPath: knowledgeBase.vaultPath,
        query,
        limit: knowledgeBase.maxNotes,
        maxCharsPerNote: knowledgeBase.maxCharsPerNote
      });

      if (result.hits.length === 0) {
        showNotice("知识库没有匹配到相关笔记");
        return undefined;
      }

      const extractedText = formatKnowledgeSearchResult(result);
      showNotice(`已读取 ${result.hits.length} 篇知识库笔记`);
      return {
        id: createId("attachment"),
        name: "Obsidian 知识库检索.md",
        mimeType: "text/markdown",
        size: extractedText.length,
        kind: "text",
        extractedText,
        status: "ready",
        createdAt: nowIso()
      };
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "知识库读取失败，请检查路径权限。");
      return undefined;
    }
  };

  const testKnowledgeBaseSearch = async () => {
    const knowledgeBase = stateRef.current.settings.knowledgeBase;
    if (!knowledgeBase.vaultPath) {
      window.alert("请先选择 Obsidian 知识库文件夹。");
      return;
    }

    const query = window.prompt("输入一个测试检索词", activeRoom?.name || "")?.trim();
    if (!query || !window.roundtableDesktop?.searchKnowledgeBase) {
      return;
    }

    try {
      const result = await window.roundtableDesktop.searchKnowledgeBase({
        vaultPath: knowledgeBase.vaultPath,
        query,
        limit: knowledgeBase.maxNotes,
        maxCharsPerNote: knowledgeBase.maxCharsPerNote
      });
      window.alert(
        result.hits.length > 0
          ? `找到 ${result.hits.length} 篇相关笔记：\n${result.hits.map((hit) => `- ${hit.relativePath}`).join("\n")}`
          : `没有找到相关笔记。\n${result.message || ""}`
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "知识库测试检索失败。");
    }
  };

  const createRoom = (input: { name: string; mode: RoomMode; roleIds: string[]; defaultRounds: number }) => {
    const timestamp = nowIso();
    const room: ChatRoom = {
      id: createId("room"),
      name: input.name,
      mode: input.mode,
      roleIds: input.roleIds,
      defaultRounds: input.defaultRounds,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setState((value) => ({
      ...value,
      rooms: [...value.rooms, room],
      activeRoomId: room.id
    }));
    setNewRoomOpen(false);
    setActiveView("chat");
    showNotice(t("roomCreated"));
  };

  const renameRoom = (room: ChatRoom) => {
    const nextName = window.prompt(t("promptRenameRoom"), room.name)?.trim();
    if (!nextName) {
      return;
    }

    updateRoom({
      ...room,
      name: nextName
    });
  };

  const duplicateRoom = (room: ChatRoom) => {
    const copyMessages = window.confirm(t("confirmCopyMessages"));
    const timestamp = nowIso();
    const nextRoom: ChatRoom = {
      ...room,
      id: createId("room"),
      name: t("roomCopySuffix", { name: room.name }),
      messages: copyMessages
        ? room.messages.map((message) => ({
            ...message,
            id: createId("message"),
            roomId: "",
            createdAt: message.createdAt
          }))
        : [],
      contextMemory: undefined,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    nextRoom.messages = nextRoom.messages.map((message) => ({ ...message, roomId: nextRoom.id }));

    setState((current) => ({
      ...current,
      rooms: [...current.rooms, nextRoom],
      activeRoomId: nextRoom.id
    }));
    setActiveView("chat");
    showNotice(t("roomDuplicated"));
  };

  const deleteRoom = (room: ChatRoom) => {
    const current = stateRef.current;
    if (current.rooms.length <= 1) {
      window.alert(t("alertKeepOneRoom"));
      return;
    }

    if (!window.confirm(t("confirmDeleteRoom", { name: room.name }))) {
      return;
    }

    const nextRooms = current.rooms.filter((item) => item.id !== room.id);
    setState((value) => ({
      ...value,
      rooms: nextRooms,
      activeRoomId: value.activeRoomId === room.id ? nextRooms[0].id : value.activeRoomId
    }));
    showNotice(t("roomDeleted"));
  };

  const makeUserMessage = (roomId: string, content: string, attachments: ChatAttachment[] = []): ChatMessage => ({
    id: createId("message"),
    roomId,
    role: "user",
    roleName: t("me"),
    content,
    attachments,
    createdAt: nowIso(),
    status: "success"
  });

  const makeAssistantMessage = (roomId: string, role: AgentRole, content: string, status: ChatMessage["status"]): ChatMessage => ({
    id: createId("message"),
    roomId,
    role: "assistant",
    roleId: role.id,
    roleName: role.name,
    content,
    createdAt: nowIso(),
    status
  });

  const getProviderForRole = (role: AgentRole, providers: ProviderConfig[]) => {
    return providers.find((provider) => provider.id === role.providerId) || providers[0];
  };

  const prepareRoundtableContext = async (input: {
    room: ChatRoom;
    messages: ChatMessage[];
    contextMemory?: RoomContextMemory;
    provider: ProviderConfig;
    model: string;
    signal: AbortSignal;
    executionInstruction: string;
  }): Promise<{ messages: ModelMessage[]; contextMemory?: RoomContextMemory }> => {
    const plan = planContextCompression(input.messages, input.contextMemory);
    let nextMemory = plan.reusableMemory;

    if (plan.archivedMessages.length > 0 && plan.messagesToCompress.length > 0) {
      let summary = plan.reusableMemory?.summary || "";

      try {
        const batches = chunkMessagesForContextCompression(plan.messagesToCompress);
        for (const batch of batches) {
          const compressionResponse = await callModel({
            provider: input.provider,
            model: input.model,
            systemPrompt: buildContextCompressionSystemPrompt(stateRef.current.settings.language),
            messages: buildContextCompressionMessages(batch, summary),
            signal: input.signal
          });
          summary = compressionResponse.content;
        }
      } catch (error) {
        if (input.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          throw error;
        }
        summary = buildDeterministicContextDigest(plan.archivedMessages);
      }

      nextMemory = createRoomContextMemory(plan.archivedMessages, summary);
      commitContextMemory(input.room.id, nextMemory);
    }

    const effectiveMemory = plan.archivedMessages.length > 0 ? nextMemory : undefined;
    return {
      messages: buildRoundtableContextMessages(plan.recentMessages, effectiveMemory, input.executionInstruction),
      contextMemory: nextMemory
    };
  };

  const testProvider = async (provider: ProviderConfig) => {
    setTestingProviderId(provider.id);

    try {
      await callModel({
        provider,
        model: provider.defaultModel,
        systemPrompt: "你是连接测试助手。只回复 OK。",
        messages: [{ role: "user", content: "请回复 OK" }]
      });

      setState((current) => ({
        ...current,
        providers: current.providers.map((item) => (item.id === provider.id ? { ...item, lastTestStatus: "success" } : item))
      }));
      showNotice("连接测试成功");
    } catch (error) {
      setState((current) => ({
        ...current,
        providers: current.providers.map((item) => (item.id === provider.id ? { ...item, lastTestStatus: "failed" } : item))
      }));
      window.alert(buildConnectionTestReport(error, provider));
    } finally {
      setTestingProviderId(undefined);
    }
  };

  const runDiscussion = async (rounds: number, topic?: string, attachments: ChatAttachment[] = []) => {
    const snapshot = stateRef.current;
    const room = snapshot.rooms.find((item) => item.id === snapshot.activeRoomId);

    if (!room) {
      return;
    }

    const discussionPlan = getMentionedDiscussionPlan(topic || "", room, snapshot.roles, rounds);
    const mentionedRoles = discussionPlan.mentionedRoles;
    const discussionRoles = discussionPlan.stages.flatMap((stage) => stage.roles);
    if (discussionRoles.length === 0) {
      window.alert(t("alertNoDiscussionRoles"));
      return;
    }

    if (snapshot.providers.length === 0) {
      window.alert(t("alertNoProviderConfig"));
      setActiveView("providers");
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsRunning(true);
    setSpeakingRoleId(undefined);

    let messages = room.messages;
    let contextMemory = room.contextMemory;
    if (topic || attachments.length > 0) {
      const knowledgeAttachment = await searchKnowledgeForTopic(topic || room.name);
      const discussionAttachments = knowledgeAttachment ? [...attachments, knowledgeAttachment] : attachments;
      messages = [...messages, makeUserMessage(room.id, topic || t("defaultAttachmentTopic"), discussionAttachments)];
      commitMessages(room.id, messages);
      if (mentionedRoles.length > 0) {
        const planText = discussionPlan.stages
          .map((stage) => {
            const names = stage.roles.map((role) => role.name).join("、");
            return stage.rounds > 1 ? `${names} x${stage.rounds}` : names;
          })
          .join(" → ");
        showNotice(t("mentionDispatching", { names: planText }));
      }
    }

    try {
      for (let stageIndex = 0; stageIndex < discussionPlan.stages.length; stageIndex += 1) {
        const stage = discussionPlan.stages[stageIndex];
        for (let roundIndex = 0; roundIndex < stage.rounds; roundIndex += 1) {
          for (let speakerIndex = 0; speakerIndex < stage.roles.length; speakerIndex += 1) {
            const role = stage.roles[speakerIndex];
            if (abortController.signal.aborted) {
              return;
            }

            setSpeakingRoleId(role.id);
            const pendingMessage = makeAssistantMessage(room.id, role, t("thinking"), "pending");
            messages = [...messages, pendingMessage];
            commitMessages(room.id, messages);

            const provider = getProviderForRole(role, snapshot.providers);

            try {
              const taskKind = getDiscussionTaskKind(
                role,
                stage,
                mentionedRoles.some((mentionedRole) => mentionedRole.id === role.id)
              );
              const execution: RoleExecutionContext = {
                stageIndex,
                stageCount: discussionPlan.stages.length,
                roundIndex,
                roundCount: stage.rounds,
                speakerIndex,
                speakerCount: stage.roles.length,
                taskKind,
                stageInstruction: stage.instruction
              };
              const executionInstruction = [
                `现在轮到「${role.name}」发言。`,
                `任务模式：${taskKind}。`,
                stage.instruction ? `只处理当前阶段指令：${stage.instruction}` : "围绕已有议题继续推进。",
                "不要执行其他角色或后续阶段的任务。"
              ].join("\n");
              const preparedContext = await prepareRoundtableContext({
                room,
                messages: messages.filter((message) => message.id !== pendingMessage.id),
                contextMemory,
                provider,
                model: role.model || provider.defaultModel,
                signal: abortController.signal,
                executionInstruction
              });
              contextMemory = preparedContext.contextMemory;
              const systemPrompt = buildRoleSystemPrompt(
                role,
                room,
                snapshot.roles,
                snapshot.settings.language,
                mentionedRoles.map((item) => item.name),
                execution
              );
              let response = await callModel({
                provider,
                model: role.model || provider.defaultModel,
                systemPrompt,
                messages: preparedContext.messages,
                signal: abortController.signal
              });

              if (detectRoleBoundaryViolation(response.content, role, snapshot.roles, taskKind)) {
                response = await callModel({
                  provider,
                  model: role.model || provider.defaultModel,
                  systemPrompt: [
                    systemPrompt,
                    "",
                    "【身份边界纠正】",
                    `上一版输出出现了身份或任务越界。重新回答时只能作为「${role.name}」完成当前这一次任务。`,
                    "不要冒充其他角色；普通讨论模式不要输出整场总结；直接给出修正后的正文。"
                  ].join("\n"),
                  messages: preparedContext.messages,
                  signal: abortController.signal
                });
              }

              messages = messages.map((message) =>
                message.id === pendingMessage.id
                  ? {
                      ...message,
                      content: response.content,
                      status: "success",
                      error: undefined
                    }
                  : message
              );
              commitMessages(room.id, messages);
            } catch (error) {
              const friendlyError = toFriendlyError(error);
              messages = messages.map((message) =>
                message.id === pendingMessage.id
                  ? {
                      ...message,
                      content: friendlyError,
                      status: "error",
                      error: friendlyError
                    }
                  : message
              );
              commitMessages(room.id, messages);
            }

            if (abortController.signal.aborted) {
              return;
            }

            await waitBetweenModelCalls(abortController.signal);
          }
        }
      }
    } finally {
      setIsRunning(false);
      setSpeakingRoleId(undefined);
      abortRef.current = null;
    }
  };

  const summarizeRoom = async () => {
    const snapshot = stateRef.current;
    const room = snapshot.rooms.find((item) => item.id === snapshot.activeRoomId);
    if (!room || room.messages.length === 0) {
      return;
    }

    const role = getSummaryRole(room, snapshot.roles);
    if (!role) {
      window.alert(t("alertNoAvailableRole"));
      return;
    }

    if (snapshot.providers.length === 0) {
      window.alert(t("alertNoProviderConfig"));
      setActiveView("providers");
      return;
    }

    const provider = getProviderForRole(role, snapshot.providers);
    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsRunning(true);
    setSpeakingRoleId(role.id);

    let messages = room.messages;
    let contextMemory = room.contextMemory;
    const pendingMessage: ChatMessage = {
      ...makeAssistantMessage(room.id, role, t("summarizing"), "pending"),
      role: "summary",
      roleName: role.name.includes("总结") ? role.name : t("summary")
    };
    messages = [...messages, pendingMessage];
    commitMessages(room.id, messages);

    try {
      const preparedContext = await prepareRoundtableContext({
        room,
        messages: messages.filter((message) => message.id !== pendingMessage.id),
        contextMemory,
        provider,
        model: role.model || provider.defaultModel,
        signal: abortController.signal,
        executionInstruction: "生成整场圆桌总结。只做总结，不模拟参会角色继续发言。"
      });
      contextMemory = preparedContext.contextMemory;
      const response = await callModel({
        provider,
        model: role.model || provider.defaultModel,
        systemPrompt: buildSummarySystemPrompt(role, room, snapshot.roles, snapshot.settings.language),
        messages: [
          ...preparedContext.messages,
          {
            role: "user",
            content: "请基于以上完整群聊生成总结，包含：核心结论、主要分歧、风险点、可执行下一步。"
          }
        ],
        signal: abortController.signal
      });

      messages = messages.map((message) =>
        message.id === pendingMessage.id
          ? {
              ...message,
              content: response.content,
              status: "success",
              error: undefined
            }
          : message
      );
      commitMessages(room.id, messages);
    } catch (error) {
      const friendlyError = toFriendlyError(error);
      messages = messages.map((message) =>
        message.id === pendingMessage.id
          ? {
              ...message,
              content: friendlyError,
              status: "error",
              error: friendlyError
            }
          : message
      );
      commitMessages(room.id, messages);
    } finally {
      setIsRunning(false);
      setSpeakingRoleId(undefined);
      abortRef.current = null;
    }
  };

  const stopDiscussion = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setSpeakingRoleId(undefined);
    showNotice(t("stopSent"));
  };

  const clearCurrentRoom = () => {
    if (!activeRoom || !window.confirm(t("confirmClearRoom"))) {
      return;
    }

    updateRoom({
      ...activeRoom,
      messages: [],
      contextMemory: undefined
    });
    showNotice(t("roomCleared"));
  };

  const copyMessage = async (message: ChatMessage) => {
    await copyText(message.content);
    showNotice(t("messageCopied"));
  };

  const deleteMessage = (messageId: string) => {
    if (!activeRoom) {
      return;
    }

    updateRoom({
      ...activeRoom,
      messages: activeRoom.messages.filter((message) => message.id !== messageId),
      contextMemory: undefined
    });
    showNotice(t("messageDeleted"));
  };

  const exportJson = () => {
    if (!activeRoom) {
      return;
    }

    downloadText(`${activeRoom.name}.json`, serializeRoomAsJson(activeRoom), "application/json;charset=utf-8");
  };

  const exportMarkdown = () => {
    if (!activeRoom) {
      return;
    }

    downloadText(`${activeRoom.name}.md`, serializeRoomAsMarkdown(activeRoom, t), "text/markdown;charset=utf-8");
  };

  const exportText = () => {
    if (!activeRoom) {
      return;
    }

    downloadText(`${activeRoom.name}.txt`, serializeRoomAsText(activeRoom, t), "text/plain;charset=utf-8");
  };

  const importJson = (content: string) => {
    if (!activeRoom) {
      return;
    }

    try {
      const importedMessages = parseImportedMessages(content).map((message) => ({
        ...message,
        id: createId("message"),
        roomId: activeRoom.id,
        status: message.status === "pending" ? "success" : message.status
      }));
      updateRoom({
        ...activeRoom,
        messages: importedMessages,
        contextMemory: undefined
      });
      showNotice(t("historyImported"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t("importFailed"));
    }
  };

  const resetAll = () => {
    const nextState = resetAppState();
    setState(nextState);
    setActiveView("chat");
    showNotice(t("dataReset"));
  };

  if (!activeRoom) {
    return null;
  }

  return (
    <I18nProvider language={state.settings.language}>
      <div className={`app-root theme-${state.settings.theme} flex min-h-screen flex-col overflow-y-auto md:h-screen md:overflow-hidden`}>
        {showOpening ? (
          <div className="opening-sequence fixed inset-0 z-50 flex items-center justify-center px-8 text-center">
            <div className="opening-content">
              <img
                src={
                  state.settings.theme === "dark"
                    ? "./brand/ai-roundtable-logo-dark.png"
                    : "./brand/ai-roundtable-logo.png"
                }
                alt="AI圆桌"
                className="opening-logo mx-auto h-auto w-[156px] select-none object-contain"
                draggable={false}
              />
              <p className="opening-slogan mt-8 text-[23px] font-medium tracking-[-0.035em] text-[var(--ink-soft)]">
                <span>从不同的答案，</span>
                <span className="opening-slogan-second">走向更好的答案</span>
              </p>
              <div className="opening-line mx-auto mt-8 h-px w-32 overflow-hidden bg-[var(--line)]">
                <span className="block h-full bg-[var(--accent)]" />
              </div>
            </div>
          </div>
        ) : null}
        <div className="window-titlebar hidden shrink-0 items-center md:flex" aria-hidden="true">
          <div className={`window-traffic-lights flex items-center gap-2 ${isDesktopApp ? "invisible" : ""}`}>
            <Circle className="h-3 w-3 fill-[#ff5f57] text-[#e34b44]" />
            <Circle className="h-3 w-3 fill-[#febc2e] text-[#e4a521]" />
            <Circle className="h-3 w-3 fill-[#28c840] text-[#20ad35]" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden md:flex-row">
          <Sidebar
            state={state}
            activeView={activeView}
            activeRoomId={state.activeRoomId}
            onViewChange={setActiveView}
            onRoomSelect={(roomId) => setState((current) => ({ ...current, activeRoomId: roomId }))}
            onCreateGroupRoom={() => openNewRoomDialog("group")}
            onCreatePrivateRoom={() => openNewRoomDialog("private")}
            onRenameRoom={renameRoom}
            onDuplicateRoom={duplicateRoom}
            onDeleteRoom={deleteRoom}
            theme={state.settings.theme}
            onThemeChange={updateTheme}
          />

          <section className="workspace-canvas relative min-h-[720px] flex-1 p-2.5 md:min-h-0 md:rounded-tl-[22px] md:p-3.5">
            {activeView === "chat" ? (
              <ChatView
                room={activeRoom}
                roles={state.roles}
                providers={state.providers}
                localAgentModelCatalogs={localAgentModelCatalogs}
                isRunning={isRunning}
                speakingRoleId={speakingRoleId}
                onUpdateRoom={updateRoom}
                onUpdateRoleModel={updateRoleModel}
                onStart={(topic, rounds, attachments) => void runDiscussion(rounds, topic, attachments)}
                onContinue={(rounds) => void runDiscussion(rounds)}
                onStop={stopDiscussion}
                onSummarize={() => void summarizeRoom()}
                onClear={clearCurrentRoom}
                onCopyMessage={(message) => void copyMessage(message)}
                onDeleteMessage={deleteMessage}
              />
            ) : null}

            {activeView === "roles" ? (
              <RolesView roles={state.roles} providers={state.providers} onSave={saveRole} onDelete={deleteRole} />
            ) : null}

            {activeView === "providers" ? (
              <ProvidersView
                providers={state.providers}
                onSave={saveProvider}
                onDelete={deleteProvider}
                onTest={testProvider}
                testingProviderId={testingProviderId}
                localAgentDetections={localAgentDetections}
                localAgentModelCatalogs={localAgentModelCatalogs}
                detectingLocalAgents={detectingLocalAgents}
                onDetectLocalAgents={() => void detectLocalAgents()}
                onSelectLocalModel={updateProviderDefaultModel}
              />
            ) : null}

            {activeView === "history" ? (
              <HistoryView
                room={activeRoom}
                onExportJson={exportJson}
                onExportMarkdown={exportMarkdown}
                onExportText={exportText}
                onImportJson={importJson}
              />
            ) : null}

            {activeView === "settings" ? (
              <SettingsView
                language={state.settings.language}
                knowledgeBase={state.settings.knowledgeBase}
                isDesktopApp={isDesktopApp}
                onLanguageChange={updateLanguage}
                onKnowledgeBaseChange={updateKnowledgeBase}
                onSelectKnowledgeBase={() => void selectKnowledgeBaseVault()}
                onTestKnowledgeBase={() => void testKnowledgeBaseSearch()}
                onReset={resetAll}
              />
            ) : null}

            <NewRoomDialog
              open={newRoomOpen}
              mode={newRoomMode}
              roles={state.roles}
              defaultName={
                newRoomMode === "private"
                  ? t("newPrivateRoomName", { count: state.rooms.length + 1 })
                  : t("newRoundtableName", { count: state.rooms.length + 1 })
              }
              onClose={() => setNewRoomOpen(false)}
              onCreate={createRoom}
            />

            {notice ? (
              <div className="notice-toast absolute right-6 top-6 z-40 rounded-xl px-4 py-3 text-sm shadow-[0_16px_40px_rgba(17,19,24,0.2)]">
                {notice}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </I18nProvider>
  );
}
