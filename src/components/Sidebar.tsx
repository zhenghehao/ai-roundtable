"use client";

import {
  Atom,
  Copy,
  FileClock,
  KeyRound,
  MessageCircle,
  MessageSquarePlus,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";
import type { AppState, ChatRoom } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export type AppView = "chat" | "roles" | "providers" | "history" | "settings";

interface SidebarProps {
  state: AppState;
  activeView: AppView;
  activeRoomId: string;
  onViewChange: (view: AppView) => void;
  onRoomSelect: (roomId: string) => void;
  onCreateRoom: () => void;
  onRenameRoom: (room: ChatRoom) => void;
  onDuplicateRoom: (room: ChatRoom) => void;
  onDeleteRoom: (room: ChatRoom) => void;
}

const navItems: Array<{ id: AppView; labelKey: "roleManagement" | "modelConfig" | "history"; icon: typeof MessageCircle }> = [
  { id: "roles", labelKey: "roleManagement", icon: Users },
  { id: "providers", labelKey: "modelConfig", icon: KeyRound },
  { id: "history", labelKey: "history", icon: FileClock }
];

export function Sidebar({
  state,
  activeView,
  activeRoomId,
  onViewChange,
  onRoomSelect,
  onCreateRoom,
  onRenameRoom,
  onDuplicateRoom,
  onDeleteRoom
}: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="flex h-auto max-h-[46vh] w-full shrink-0 flex-col bg-transparent px-3 pb-3 pt-3 md:h-full md:max-h-none md:w-[268px] md:px-4 md:pb-4 md:pt-4">
      <div className="mb-4 flex h-3 items-center gap-2 px-1 md:mb-5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#282b38] text-[#c7fbff] shadow-[0_14px_28px_rgba(15,23,42,0.16)]">
            <Atom className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">{t("appTitle")}</h1>
            <p className="text-xs text-slate-500">{t("appSubtitle")}</p>
          </div>
        </div>
        <Button className="mt-5 w-full justify-start rounded-2xl bg-white" variant="secondary" onClick={onCreateRoom}>
          <MessageSquarePlus className="h-4 w-4" />
          {t("newChat")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-5 scrollbar-thin">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("chatRooms")}</div>
        <div className="space-y-1.5">
          {state.rooms.map((room) => {
            const selected = room.id === activeRoomId;
            return (
              <div
                key={room.id}
                className={cn(
                  "group rounded-2xl border px-3 py-2.5 transition",
                  selected && activeView === "chat"
                    ? "border-white bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                    : "border-transparent bg-transparent hover:border-white/80 hover:bg-white/70"
                )}
              >
                <button
                  className="w-full rounded-xl text-left focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  onClick={() => {
                    onRoomSelect(room.id);
                    onViewChange("chat");
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{room.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{room.messages.length}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(room.updatedAt)}</div>
                </button>
                <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => onRenameRoom(room)} title={t("rename")}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => onDuplicateRoom(room)} title={t("duplicateRoom")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => onDeleteRoom(room)} title={t("delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("workspace")}</div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
                  activeView === item.id ? "bg-white text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.06)]" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-1">
        <button
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
            activeView === "settings" ? "bg-white text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.06)]" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
          )}
          onClick={() => onViewChange("settings")}
        >
          <Settings className="h-4 w-4" />
          {t("settings")}
        </button>
        <div className="mt-3 rounded-2xl border border-white/70 bg-white/50 px-3 py-3 text-xs leading-5 text-slate-500">
          {t("apiKeyLocalHint")}
        </div>
      </div>
    </aside>
  );
}
