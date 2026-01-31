import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface RevealRequestNotificationProps {
  requesterId: string;
  requesterName: string;
  requesterColor: string;
  onDismiss?: () => void;
  top?: number;
}

export function RevealRequestNotification({
  requesterName,
  requesterColor,
  onDismiss,
  top = 20,
}: RevealRequestNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animation
    const timeoutId = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div 
      className={`reveal-request-banner ${isVisible ? 'visible' : ''}`}
      style={{ top: `${top}px` }}
    >
      <div className="reveal-request-banner-content">
        <span>
          <span style={{ color: requesterColor, fontWeight: 700 }}>{requesterName}</span> wants to reveal their identity!
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            effect="none"
            className="ml-4 h-6 px-2 text-xs hover:scale-110 active:scale-90"
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
