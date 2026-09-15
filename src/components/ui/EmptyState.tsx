// -- Composant EmptyState (nouveau V2) ------------------------------------
// Phase 6.2 -- React.memo
import { memo } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

function EmptyStateComponent({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 opacity-40">
        {icon || <Inbox size={36} />}
      </div>
      <div className="text-text font-medium text-sm">{title}</div>
      {description && (
        <div className="text-text-sec text-xs mt-1 max-w-xs">{description}</div>
      )}
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);
