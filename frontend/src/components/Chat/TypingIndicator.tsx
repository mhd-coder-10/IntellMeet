// Shows who is currently typing with animated dots
// Hidden when no one is typing

interface Props {
    usernames: string[];
}

export function TypingIndicator({ usernames }: Props) {
    if (usernames.length === 0) return null;

    const text =
        usernames.length === 1
            ? `${usernames[0]} is typing`
            : `${usernames.slice(0, 2).join(", ")} are typing`;

    return (
        <div className="px-4 py-2 text-xs text-gray-500 italic flex items-center gap-2">
            <span>{text}</span>
            <span className="flex gap-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                <span
                    className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                />
                <span
                    className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                />
            </span>
        </div>
    );
}