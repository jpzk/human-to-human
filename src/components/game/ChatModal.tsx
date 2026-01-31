import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  fromId: string;
  fromName: string;
  text: string;
  timestamp: number;
  isOwn: boolean;
}

interface ChatModalProps {
  chatId: string;
  partnerName: string;
  partnerColor: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onCloseRequest: () => void;
}

const MAX_MESSAGE_LENGTH = 500;

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatModal({
  partnerName,
  partnerColor,
  messages,
  onSendMessage,
  onCloseRequest,
}: ChatModalProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) return;
    
    onSendMessage(trimmed);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col w-[90%] max-w-2xl h-[80vh] max-h-[600px] bg-background border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Connected with{" "}
                <span style={{ color: partnerColor }}>{partnerName}</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Share your contact info to stay connected!
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Start the conversation! Share your contact info below.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    msg.isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-foreground"
                  }`}
                  style={!msg.isOwn ? { borderLeft: `3px solid ${partnerColor}` } : undefined}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 border-t border-border">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
              className="flex-1 min-h-[60px] max-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              onClick={handleSend}
              disabled={inputText.trim().length === 0 || inputText.length > MAX_MESSAGE_LENGTH}
              className="self-end"
            >
              Send
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {inputText.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border">
          <Button
            onClick={onCloseRequest}
            variant="outline"
            className="w-full"
          >
            Close Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
