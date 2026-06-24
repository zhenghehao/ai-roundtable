"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  Copy,
  FileClock,
  KeyRound,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n-context";
import type { AppState, ChatRoom, ThemeMode } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export type AppView = "chat" | "roles" | "providers" | "history" | "settings";

interface SidebarProps {
  state: AppState;
  activeView: AppView;
  activeRoomId: string;
  onViewChange: (view: AppView) => void;
  onRoomSelect: (roomId: string) => void;
  onCreateGroupRoom: () => void;
  onCreatePrivateRoom: () => void;
  onRenameRoom: (room: ChatRoom) => void;
  onDuplicateRoom: (room: ChatRoom) => void;
  onDeleteRoom: (room: ChatRoom) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
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
  onCreateGroupRoom,
  onCreatePrivateRoom,
  onRenameRoom,
  onDuplicateRoom,
  onDeleteRoom,
  theme,
  onThemeChange
}: SidebarProps) {
  const { t } = useI18n();
  const roomListRef = useRef<HTMLDivElement>(null);
  const [roomScroll, setRoomScroll] = useState({
    canScroll: false,
    atTop: true,
    atBottom: true
  });

  const updateRoomScroll = useCallback(() => {
    const roomList = roomListRef.current;
    if (!roomList) {
      return;
    }

    const canScroll = roomList.scrollHeight > roomList.clientHeight + 1;
    setRoomScroll({
      canScroll,
      atTop: roomList.scrollTop <= 1,
      atBottom: roomList.scrollTop + roomList.clientHeight >= roomList.scrollHeight - 1
    });
  }, []);

  useEffect(() => {
    const roomList = roomListRef.current;
    if (!roomList) {
      return;
    }

    const selectedRoom = Array.from(roomList.children).find(
      (element) => element instanceof HTMLElement && element.dataset.roomId === activeRoomId
    );
    selectedRoom?.scrollIntoView({ block: "nearest" });
    updateRoomScroll();
  }, [activeRoomId, state.rooms.length, updateRoomScroll]);

  return (
    <aside className="sidebar-shell flex h-auto max-h-[46vh] w-full shrink-0 flex-col px-3 pb-3 pt-3 md:h-full md:max-h-none md:w-[248px] md:px-3.5 md:pb-5 md:pt-5">
      <div className="px-1.5">
        <div className="flex h-8 items-center">
          <img
            src={theme === "dark" ? "./brand/ai-roundtable-logo-dark.png" : "./brand/ai-roundtable-logo.png"}
            alt={t("appTitle")}
            className="brand-logo h-auto w-[108px] select-none object-contain"
            draggable={false}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button className="sidebar-primary-action w-full justify-center px-2" variant="secondary" onClick={onCreateGroupRoom}>
            <span className="whitespace-nowrap">{t("newGroupChat")}</span>
          </Button>
          <Button
            className="sidebar-secondary-action w-full justify-center px-2"
            variant="secondary"
            onClick={onCreatePrivateRoom}
          >
            <span className="whitespace-nowrap">{t("newPrivateChat")}</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col py-4">
        <div className="shrink-0">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-subtle)]">{t("chatRooms")}</span>
            {state.rooms.length > 3 ? (
              <span className="text-[9px] tabular-nums text-[var(--sidebar-subtle)]">{state.rooms.length} 个</span>
            ) : null}
          </div>
          <div className="room-list-shell relative">
            <div
              ref={roomListRef}
              className="room-list-scroll max-h-[224px] space-y-1 overflow-y-auto pr-1.5"
              onScroll={updateRoomScroll}
              aria-label={`${t("chatRooms")}，可上下滚动`}
              tabIndex={state.rooms.length > 3 ? 0 : -1}
            >
              {state.rooms.map((room) => {
                const selected = room.id === activeRoomId;
                return (
                  <div
                    key={room.id}
                    data-room-id={room.id}
                    className={cn(
                      "group relative min-h-[72px] rounded-[13px] border px-3 py-2 transition duration-200",
                      selected && activeView === "chat"
                        ? "sidebar-item-active"
                        : "border-transparent bg-transparent hover:bg-[var(--sidebar-hover)]"
                    )}
                  >
                    {selected && activeView === "chat" ? <span className="absolute -left-1 top-3 h-7 w-[3px] rounded-full bg-[var(--accent)]" /> : null}
                    <button
                      className="flex min-h-[54px] w-full flex-col justify-center rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      onClick={() => {
                        onRoomSelect(room.id);
                        onViewChange("chat");
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[var(--sidebar-ink)]">{room.name}</span>
                        <span className="text-[10px] tabular-nums text-[var(--sidebar-subtle)]">{room.messages.length}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--sidebar-subtle)]">
                        <span>{formatDateTime(room.updatedAt)}</span>
                        <span>·</span>
                        <span>{t(room.mode === "private" ? "privateChatBadge" : "groupChatBadge")}</span>
                      </div>
                    </button>
                    <div className="pointer-events-none absolute bottom-1.5 right-2 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                      <Button className="sidebar-icon-button h-7 w-7" size="icon" variant="ghost" onClick={() => onRenameRoom(room)} title={t("rename")}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button className="sidebar-icon-button h-7 w-7" size="icon" variant="ghost" onClick={() => onDuplicateRoom(room)} title={t("duplicateRoom")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button className="sidebar-icon-button h-7 w-7 hover:text-rose-500" size="icon" variant="ghost" onClick={() => onDeleteRoom(room)} title={t("delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {roomScroll.canScroll && !roomScroll.atTop ? <div className="room-scroll-fade room-scroll-fade-top" /> : null}
            {roomScroll.canScroll && !roomScroll.atBottom ? <div className="room-scroll-fade room-scroll-fade-bottom" /> : null}
          </div>
          {roomScroll.canScroll ? (
            <div className="room-scroll-hint" aria-hidden="true">
              <ChevronsUpDown className="h-3 w-3" />
              <span>上下滑动查看更多</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 shrink-0">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-subtle)]">{t("workspace")}</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] font-medium text-[var(--sidebar-muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
                    activeView === item.id ? "sidebar-item-active !text-[var(--sidebar-ink)]" : "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-ink)]"
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
      </div>

      <div className="px-1">
        <button
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] font-medium text-[var(--sidebar-muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
            activeView === "settings" ? "sidebar-item-active !text-[var(--sidebar-ink)]" : "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-ink)]"
          )}
          onClick={() => onViewChange("settings")}
        >
          <Settings className="h-4 w-4" />
          {t("settings")}
        </button>
        <div className="theme-control mt-3 rounded-[13px] border p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className={cn("theme-option", theme === "light" && "theme-option-active")}
              onClick={() => onThemeChange("light")}
              aria-pressed={theme === "light"}
            >
              <Sun className="h-3.5 w-3.5" />
              轻盈
            </button>
            <button
              type="button"
              className={cn("theme-option", theme === "dark" && "theme-option-active")}
              onClick={() => onThemeChange("dark")}
              aria-pressed={theme === "dark"}
            >
              <Moon className="h-3.5 w-3.5" />
              暗夜
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1.5 pb-0.5 text-[9px] tracking-[0.02em] text-[var(--sidebar-subtle)]">
            <span>API Key 仅保存在本地</span>
            <span className="font-medium tracking-[0.12em]">LOCAL</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
