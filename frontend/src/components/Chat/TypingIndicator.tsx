// Shows who is currently typing with modern animated pulse & bounce
// Styled to fit seamlessly with the meeting room dark theme

interface Props {
  usernames: string[];
}

export function TypingIndicator({ usernames }: Props) {
  if (usernames.length === 0) return null;

  const renderText = () => {
    if (usernames.length === 1) {
      return (
        <span>
          <strong className="font-medium text-blue-400">{usernames[0]}</strong> is typing
        </span>
      );
    }
    if (usernames.length === 2) {
      return (
        <span>
          <strong className="font-medium text-blue-400">{usernames[0]}</strong> and{" "}
          <strong className="font-medium text-blue-400">{usernames[1]}</strong> are typing
        </span>
      );
    }
    return (
      <span>
        <strong className="font-medium text-blue-400">{usernames[0]}</strong> and{" "}
        <strong className="font-medium text-blue-400">{usernames.length - 1} others</strong> are typing
      </span>
    );
  };

  return (
    <div className="px-4 py-2 flex items-center">
      <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700/60 backdrop-blur-md shadow-sm text-xs text-gray-300 animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
        </div>
        <div className="text-[11px] truncate max-w-[240px]">{renderText()}</div>
      </div>
    </div>
  );
}