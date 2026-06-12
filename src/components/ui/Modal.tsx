import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";

interface ModalProps {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, description, open, onClose, children, footer }: ModalProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111318]/55 px-4 py-6 backdrop-blur-[3px]">
      <div className="modal-panel flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border shadow-[0_28px_90px_rgba(17,19,24,0.32)]">
        <div className="modal-divider flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h2 className="workspace-title page-heading text-lg font-semibold">{title}</h2>
            {description ? <p className="workspace-description mt-1 text-sm">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} title={t("close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
        {footer ? <div className="modal-divider flex justify-end gap-2 border-t px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
