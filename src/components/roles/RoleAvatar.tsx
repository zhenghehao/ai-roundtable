import type { AgentRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoleAvatarProps {
  role?: Pick<AgentRole, "name" | "avatarColor" | "avatarImage">;
  fallbackName?: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClass = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg"
};

export function RoleAvatar({ role, fallbackName = "AI", color, size = "sm", className }: RoleAvatarProps) {
  const name = role?.name || fallbackName;
  const background = color || role?.avatarColor || "#0f766e";

  if (role?.avatarImage) {
    return (
      <img
        src={role.avatarImage}
        alt={`${name}头像`}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-black/5", sizeClass[size], className)}
      />
    );
  }

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", sizeClass[size], className)}
      style={{ background }}
    >
      {name.slice(0, 1) || "AI"}
    </div>
  );
}
