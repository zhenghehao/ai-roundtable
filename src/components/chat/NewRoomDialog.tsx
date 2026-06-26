"use client";

import { BookOpen, GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { FILE_MASTER_ROLE_ID } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, KnowledgeBaseSettings, RoomKnowledgeBaseSettings, RoomMode } from "@/lib/types";
import { clampRounds, cn } from "@/lib/utils";

interface NewRoomDialogProps {
  open: boolean;
  mode: RoomMode;
  roles: AgentRole[];
  defaultName: string;
  knowledgeBase: KnowledgeBaseSettings;
  isDesktopApp: boolean;
  onClose: () => void;
  onSelectKnowledgeBase: () => void;
  onCreate: (input: { name: string; mode: RoomMode; roleIds: string[]; defaultRounds: number; knowledgeBase?: RoomKnowledgeBaseSettings }) => void;
}

export function NewRoomDialog({
  open,
  mode,
  roles,
  defaultName,
  knowledgeBase,
  isDesktopApp,
  onClose,
  onSelectKnowledgeBase,
  onCreate
}: NewRoomDialogProps) {
  const { t } = useI18n();
  const enabledRoleIds = useMemo(() => roles.filter((role) => role.enabled).map((role) => role.id), [roles]);
  const defaultGroupRoleIds = useMemo(
    () => roles.filter((role) => role.enabled && role.id !== FILE_MASTER_ROLE_ID).map((role) => role.id),
    [roles]
  );
  const isPrivate = mode === "private";
  const [name, setName] = useState(defaultName);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(enabledRoleIds);
  const [draggingRoleId, setDraggingRoleId] = useState<string | undefined>();
  const [rounds, setRounds] = useState(2);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(false);
  const [knowledgeMode, setKnowledgeMode] = useState<RoomKnowledgeBaseSettings["mode"]>("auto");
  const orderedRoles = useMemo(() => {
    const selectedRoles = selectedRoleIds
      .map((roleId) => roles.find((role) => role.id === roleId))
      .filter((role): role is AgentRole => Boolean(role));
    const unselectedRoles = roles.filter((role) => !selectedRoleIds.includes(role.id));

    return [...selectedRoles, ...unselectedRoles];
  }, [roles, selectedRoleIds]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(defaultName);
    setSelectedRoleIds(isPrivate ? enabledRoleIds.slice(0, 1) : defaultGroupRoleIds);
    setRounds(isPrivate ? 1 : 2);
    setKnowledgeEnabled(Boolean(knowledgeBase.enabled && knowledgeBase.vaultPath));
    setKnowledgeMode("auto");
    setDraggingRoleId(undefined);
  }, [defaultGroupRoleIds, defaultName, enabledRoleIds, isPrivate, knowledgeBase.enabled, knowledgeBase.vaultPath, open]);

  const toggleRole = (roleId: string) => {
    if (isPrivate) {
      setSelectedRoleIds((current) => (current.includes(roleId) ? [] : [roleId]));
      return;
    }

    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId]
    );
  };

  const moveRoleBefore = (sourceRoleId: string, targetRoleId: string) => {
    if (sourceRoleId === targetRoleId) {
      return;
    }

    setSelectedRoleIds((current) => {
      if (!current.includes(sourceRoleId) || !current.includes(targetRoleId)) {
        return current;
      }

      const next = current.filter((roleId) => roleId !== sourceRoleId);
      const targetIndex = next.indexOf(targetRoleId);
      next.splice(targetIndex, 0, sourceRoleId);
      return next;
    });
  };

  const handleCreate = () => {
    const finalRoleIds = selectedRoleIds.filter((roleId) => roles.some((role) => role.id === roleId));

    if (finalRoleIds.length === 0) {
      window.alert(t("alertNeedParticipant"));
      return;
    }

    if (isPrivate && finalRoleIds.length !== 1) {
      window.alert(t("alertNeedPrivateParticipant"));
      return;
    }

    onCreate({
      name: name.trim() || defaultName,
      mode,
      roleIds: finalRoleIds,
      defaultRounds: clampRounds(rounds),
      knowledgeBase: {
        enabled: knowledgeEnabled && Boolean(knowledgeBase.vaultPath),
        mode: knowledgeMode,
        selectedItems: [],
        maxNotes: knowledgeBase.maxNotes,
        maxCharsPerNote: knowledgeBase.maxCharsPerNote
      }
    });
  };

  return (
    <Modal
      title={isPrivate ? t("newPrivateRoomTitle") : t("newRoomTitle")}
      description={isPrivate ? t("newPrivateRoomDesc") : t("newRoomDesc")}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <Field label={t("roomName")}>
            <TextInput
              value={name}
              placeholder={isPrivate ? t("privateRoomNamePlaceholder") : t("roomNamePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label={t("defaultRounds")}>
            <select
              className="field-control h-10 w-full rounded-[10px] border px-3 text-sm outline-none transition focus:ring-[3px]"
              value={rounds}
              onChange={(event) => setRounds(Number(event.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((round) => (
                <option key={round} value={round}>
                  {t("roundUnit", { count: round })}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <section className="rounded-[13px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-950">知识库参与讨论</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {knowledgeBase.vaultPath ? `当前目录：${knowledgeBase.vaultPath}` : "先选择 Obsidian 笔记目录，之后这个房间才能读取知识库。"}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={knowledgeEnabled}
                disabled={!isDesktopApp || !knowledgeBase.vaultPath}
                className="h-4 w-4 accent-[var(--accent)]"
                onChange={(event) => setKnowledgeEnabled(event.target.checked)}
              />
              使用知识库
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="field-control h-9 rounded-[9px] border px-3 text-xs outline-none transition focus:ring-[3px]"
              value={knowledgeMode}
              disabled={!knowledgeEnabled}
              onChange={(event) => setKnowledgeMode(event.target.value as RoomKnowledgeBaseSettings["mode"])}
            >
              <option value="auto">自动按话题检索</option>
              <option value="selection">只使用手动选择的笔记</option>
            </select>
            <Button type="button" size="sm" variant="secondary" onClick={onSelectKnowledgeBase} disabled={!isDesktopApp}>
              选择笔记目录
            </Button>
            {knowledgeMode === "selection" ? (
              <span className="text-xs text-[var(--muted)]">创建后可在聊天输入区点“知识库”选择具体文件或文件夹。</span>
            ) : null}
          </div>
        </section>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">{isPrivate ? t("participants") : t("participantsAndOrder")}</h3>
              <p className="mt-1 text-xs text-gray-500">{isPrivate ? t("privateParticipantsDesc") : t("participantsOrderDesc")}</p>
            </div>
            {!isPrivate ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => setSelectedRoleIds(roles.map((role) => role.id))}>
                  {t("selectAll")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedRoleIds([])}>
                  {t("clear")}
                </Button>
              </div>
            ) : null}
          </div>

          {roles.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {t("noRolesCreateFirst")}
            </div>
          ) : (
            <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 scrollbar-thin md:grid-cols-2">
              {orderedRoles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);
                const orderIndex = selectedRoleIds.indexOf(role.id);

                return (
                  <button
                    key={role.id}
                    type="button"
                    onDragOver={(event) => {
                      if (draggingRoleId && checked) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingRoleId && checked) {
                        moveRoleBefore(draggingRoleId, role.id);
                      }
                      setDraggingRoleId(undefined);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-[11px] border p-3 text-left transition",
                      checked ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface-strong)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-muted)]"
                    )}
                    onClick={() => toggleRole(role.id)}
                  >
                    {checked && !isPrivate ? (
                      <span
                        className="mt-1 flex h-7 w-5 cursor-grab items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--ink)] active:cursor-grabbing"
                        draggable
                        title={t("dragToReorder")}
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", role.id);
                          setDraggingRoleId(role.id);
                        }}
                        onDragEnd={() => setDraggingRoleId(undefined)}
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="mt-1 h-7 w-5" />
                    )}
                    <div className="relative">
                      <RoleAvatar role={role} size="sm" />
                      {checked && !isPrivate ? (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
                          {orderIndex + 1}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-950">{role.name}</span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line-strong)] bg-[var(--surface-strong)]"
                          )}
                        >
                          {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{role.speakingStyle || role.systemPrompt}</p>
                      {!role.enabled ? <p className="mt-1 text-xs text-amber-600">{t("disabledRoleHint")}</p> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleCreate} disabled={roles.length === 0}>
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
