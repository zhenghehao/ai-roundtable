"use client";

import { Edit3, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProviderForm } from "@/components/providers/ProviderForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n-context";
import type { ProviderConfig } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface ProvidersViewProps {
  providers: ProviderConfig[];
  onSave: (provider: ProviderConfig) => void;
  onDelete: (providerId: string) => void;
}

export function ProvidersView({ providers, onSave, onDelete }: ProvidersViewProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ProviderConfig | undefined>();
  const [open, setOpen] = useState(false);

  const closeModal = () => {
    setOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="app-surface mx-auto flex h-full max-w-6xl flex-col overflow-y-auto rounded-[28px] px-5 py-6 scrollbar-thin md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-950">{t("providersTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("providersDesc")}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("newProvider")}
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="mt-10 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-950">{t("noProvidersTitle")}</h3>
            <p className="mt-2 text-sm text-gray-500">{t("noProvidersDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-gray-950">{provider.name}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {provider.protocol === "anthropic" ? t("protocolAnthropic") : t("protocolOpenAI")}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-gray-600">{provider.baseUrl || t("baseUrlMissing")}</p>
                  <p className="mt-1 text-sm text-gray-500">{t("defaultModelLabel", { model: provider.defaultModel || t("notFilled") })}</p>
                  {provider.note ? <p className="mt-3 text-sm text-gray-500">{provider.note}</p> : null}
                  <p className="mt-3 text-xs text-gray-400">{t("updatedAt", { time: formatDateTime(provider.updatedAt) })}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    title={t("edit")}
                    onClick={() => {
                      setEditing(provider);
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
                      if (window.confirm(t("confirmDeleteProvider", { name: provider.name }))) {
                        onDelete(provider.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal title={editing ? t("editProvider") : t("newProvider")} open={open} onClose={closeModal}>
        <ProviderForm
          provider={editing}
          onSave={(provider) => {
            onSave(provider);
            closeModal();
          }}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
