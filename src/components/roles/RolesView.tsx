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
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[18px] px-5 py-6 scrollbar-thin md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
        <div>
          <p className="workspace-description mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{t("workspace")}</p>
          <h2 className="workspace-title page-heading text-2xl font-semibold">{t("rolesTitle")}</h2>
          <p className="workspace-description mt-1.5 text-sm">{t("rolesDesc")}</p>
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
        <div className="mt-10 flex min-h-80 items-center justify-center rounded-[14px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-strong)] px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-950">{t("noRolesTitle")}</h3>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const provider = providers.find((item) => item.id === role.providerId);
            return (
              <div key={role.id} className="content-card flex min-h-[250px] flex-col rounded-[14px] p-5 transition hover:-translate-y-0.5 hover:border-[#c8c7c1] hover:shadow-[0_10px_30px_rgba(23,24,30,0.07)]">
                <div className="flex items-start gap-4">
                  <RoleAvatar role={role} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="card-title truncate text-base font-semibold">{role.name}</h3>
                      <span className={role.enabled ? "inline-flex items-center gap-1 text-[10px] text-emerald-700" : "inline-flex items-center gap-1 text-[10px] text-gray-400"}>
                        <span className={role.enabled ? "h-1.5 w-1.5 rounded-full bg-emerald-500" : "h-1.5 w-1.5 rounded-full bg-gray-300"} />
                        {role.enabled ? t("enabled") : t("disabled")}
                      </span>
                    </div>
                    {role.identityFileContent ? (
                      <p className="mt-2 inline-flex rounded-[7px] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
                        {t("identityFileLoaded", { name: role.identityFileName || t("identityFile") })}
                      </p>
                    ) : null}
                    <p className="card-copy mt-3 line-clamp-3 text-sm leading-6">{role.systemPrompt}</p>
                    <div className="card-copy mt-4 border-t border-[var(--line-soft)] pt-3 text-xs leading-5">
                      <p>{t("provider")}：{provider?.name || t("unspecified")}</p>
                      <p>{t("model")}：{role.model || provider?.defaultModel || t("useProviderDefault")}</p>
                    </div>
                    <p className="card-copy mt-2 text-[10px]">{t("updatedAt", { time: formatDateTime(role.updatedAt) })}</p>
                  </div>
                </div>
                <div className="mt-auto flex justify-end gap-2 pt-4">
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
