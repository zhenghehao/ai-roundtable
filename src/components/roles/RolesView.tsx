"use client";

import { Edit3, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { RoleForm } from "@/components/roles/RoleForm";
import { RoleAvatar } from "@/components/roles/RoleAvatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n-context";
import type { AgentRole, ProviderConfig } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface RolesViewProps {
  roles: AgentRole[];
  providers: ProviderConfig[];
  onSave: (role: AgentRole) => void;
  onDelete: (roleId: string) => void;
}

export function RolesView({ roles, providers, onSave, onDelete }: RolesViewProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<AgentRole | undefined>();
  const [open, setOpen] = useState(false);

  const closeModal = () => {
    setOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[28px] px-5 py-6 scrollbar-thin md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-950">{t("rolesTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("rolesDesc")}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("newRole")}
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="mt-10 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-950">{t("noRolesTitle")}</h3>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {roles.map((role) => {
            const provider = providers.find((item) => item.id === role.providerId);
            return (
              <div key={role.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                <div className="flex items-start gap-4">
                  <RoleAvatar role={role} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-950">{role.name}</h3>
                      <span className={role.enabled ? "text-xs text-teal-700" : "text-xs text-gray-400"}>
                        {role.enabled ? t("enabled") : t("disabled")}
                      </span>
                    </div>
                    {role.identityFileContent ? (
                      <p className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        {t("identityFileLoaded", { name: role.identityFileName || t("identityFile") })}
                      </p>
                    ) : null}
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{role.systemPrompt}</p>
                    <p className="mt-3 text-sm text-gray-500">{t("provider")}：{provider?.name || t("unspecified")}</p>
                    <p className="mt-1 text-sm text-gray-500">{t("model")}：{role.model || provider?.defaultModel || t("useProviderDefault")}</p>
                    <p className="mt-3 text-xs text-gray-400">{t("updatedAt", { time: formatDateTime(role.updatedAt) })}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="icon"
                    title={t("edit")}
                    onClick={() => {
                      setEditing(role);
                      setOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    title={t("delete")}
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(t("confirmDeleteRole", { name: role.name }))) {
                        onDelete(role.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal title={editing ? t("editRole") : t("newRole")} open={open} onClose={closeModal}>
        <RoleForm
          role={editing}
          providers={providers}
          onSave={(role) => {
            onSave(role);
            closeModal();
          }}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
