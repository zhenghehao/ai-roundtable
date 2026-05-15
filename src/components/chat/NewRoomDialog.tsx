"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole } from "@/lib/types";
import { clampRounds, cn } from "@/lib/utils";

interface NewRoomDialogProps {
  open: boolean;
  roles: AgentRole[];
  defaultName: string;
  onClose: () => void;
  onCreate: (input: { name: string; roleIds: string[]; defaultRounds: number }) => void;
}

export function NewRoomDialog({ open, roles, defaultName, onClose, onCreate }: NewRoomDialogProps) {
  const { t } = useI18n();
  const enabledRoleIds = useMemo(() => roles.filter((role) => role.enabled).map((role) => role.id), [roles]);
  const [name, setName] = useState(defaultName);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(enabledRoleIds);
  const [rounds, setRounds] = useState(2);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(defaultName);
    setSelectedRoleIds(enabledRoleIds);
    setRounds(2);
  }, [defaultName, enabledRoleIds, open]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId]
    );
  };

  const handleCreate = () => {
    const finalRoleIds = selectedRoleIds.filter((roleId) => roles.some((role) => role.id === roleId));

    if (finalRoleIds.length === 0) {
      window.alert(t("alertNeedParticipant"));
      return;
    }

    onCreate({
      name: name.trim() || defaultName,
      roleIds: finalRoleIds,
      defaultRounds: clampRounds(rounds)
    });
  };

  return (
    <Modal title={t("newRoomTitle")} description={t("newRoomDesc")} open={open} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <Field label={t("roomName")}>
            <TextInput value={name} placeholder={t("roomNamePlaceholder")} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label={t("defaultRounds")}>
            <select
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-950">{t("participants")}</h3>
              <p className="mt-1 text-xs text-gray-500">{t("participantsDesc")}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setSelectedRoleIds(roles.map((role) => role.id))}>
                {t("selectAll")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedRoleIds([])}>
                {t("clear")}
              </Button>
            </div>
          </div>

          {roles.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {t("noRolesCreateFirst")}
            </div>
          ) : (
            <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 scrollbar-thin md:grid-cols-2">
              {roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);

                return (
                  <button
                    key={role.id}
                    type="button"
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition",
                      checked ? "border-teal-300 bg-teal-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    )}
                    onClick={() => toggleRole(role.id)}
                  >
                    <RoleAvatar role={role} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-950">{role.name}</span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked ? "border-teal-600 bg-teal-600" : "border-gray-300 bg-white"
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
