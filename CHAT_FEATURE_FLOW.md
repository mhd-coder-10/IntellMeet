# 🚀 IntelliMeet - Complete Chat Feature Architecture & Interview Flow Guide

Is document me **IntelliMeet ke Chat Feature** ka complete end-to-end flow detail me explain kiya gaya hai — Backend (Database, Repository, Service, Controller, Socket.io) se lekar Frontend (API, Zustand Store, Custom Hooks, UI Components) tak. Yeh guide interview preparation aur code understanding dono ke liye structured hai.

---

## 📌 Table of Contents
1. [High-Level Architecture & Flow Diagram](#1-high-level-architecture--flow-diagram)
2. [Backend Deep Dive (File-by-File)](#2-backend-deep-dive-file-by-file)
   - [Model: ChatMessage.js](#a-modelschatmessagejs)
   - [Repository: chatRepository.js](#b-repositorieschatrepositoryjs)
   - [Service: chatService.js](#c-serviceschatservicejs)
   - [Socket Handler: chatSocket.js](#d-socketchatsocketjs)
   - [Controller & Routes: chatController.js & chatRoutes.js](#e-controller--routes)
3. [Frontend Deep Dive (File-by-File)](#3-frontend-deep-dive-file-by-file)
   - [Types: chat.ts](#a-typeschatts)
   - [API Service: chatService.ts](#b-serviceschatservicets)
   - [State Management: chatStore.ts (Zustand)](#c-storechatstorets)
   - [Custom Hook: useChat.ts](#d-hooksusechatts)
   - [Components: ChatPanel, ChatMessage, ChatInput, TypingIndicator](#e-ui-components)
4. [Step-by-Step Execution Scenarios](#4-step-by-step-execution-scenarios)
   - [Scenario 1: Sending a Chat Message](#scenario-1-sending-a-chat-message)
   - [Scenario 2: Typing Indicator (Debounced)](#scenario-2-typing-indicator-debounced)
   - [Scenario 3: Host Moderation (Message Delete)](#scenario-3-host-moderation-message-delete)
5. [Top Interview Questions & Answers](#5-top-interview-questions--answers)

---

## 1. High-Level Architecture & Flow Diagram

### 🔄 End-to-End Chat Cycle

```
[ User A Types & Presses Enter ]
              │
              ▼
    [ ChatInput.tsx ]
              │ (onSend callback)
              ▼
     [ useChat.ts ]  ───► socket.emit("chat:send", { meetingId, message })
                                │
════════════════════════════════╪═══════════════════════════════════
        NETWORK / SOCKET.IO    │
════════════════════════════════╪═══════════════════════════════════
                                ▼
                       [ chatSocket.js ] (Backend Listener)
                                │
                                ▼
                       [ chatService.js ] (Business Logic & Validation)
                                │
                                ▼
                     [ chatRepository.js ] (MongoDB Driver)
                                │
                                ▼
                     [ MongoDB Database ] (Saved with sender ref)
                                │
                                ▼
                       [ chatSocket.js ]
                                │
                io.to(meetingId).emit("chat:message", savedMessage)
                                │
════════════════════════════════╪═══════════════════════════════════
                                │ (Broadcasted to all room members)
════════════════════════════════╪═══════════════════════════════════
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
    [ User A (Sender) ]                 [ User B (Receiver) ]
      useChat.ts                          useChat.ts
          │                                   │
          ▼                                   ▼
      chatStore.ts                        chatStore.ts
    (addMessage)                        (addMessage)
          │                                   │
          ▼                                   ▼
    [ ChatPanel.tsx ]                   [ ChatPanel.tsx ]
    (Auto-scrolls & renders             (Shows unread badge &
     blue gradient bubble)               renders dark bubble)
```

---

## 2. Backend Deep Dive (File-by-File)

Backend me Clean Architecture / Layered Pattern follow kiya gaya hai:
`Route -> Controller -> Service -> Repository -> Model`.
Real-time messaging ke liye **Socket.io room namespaces** use hote hain.

### A. `models/ChatMessage.js`
*Path:* `backend/src/models/ChatMessage.js`

**Kaam:** MongoDB me message schema define karta hai.
- `meeting`: Konsi meeting ka message hai (ObjectId ref: `Meeting`).
- `sender`: Kis user ne bheja hai (ObjectId ref: `User`).
- `message`: Actual text content (Trimmed, max 2000 chars).
- `type`: `"text"` ya `"system"`.
- `isDeleted`: Boolean flag (true agar delete kiya gaya ho).
- `deletedBy`: `"host"` ya user identifier.
- `timestamps`: `createdAt` aur `updatedAt` automatically track karta hai.

```javascript
const chatMessageSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: ["text", "system"], default: "text" },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);
```

---

### B. `repositories/chatRepository.js`
*Path:* `backend/src/repositories/chatRepository.js`

**Kaam:** Pure database queries execute karta hai (Data Access Layer).
- `createMessage(data)`: Naya message record create karta hai.
- `findByMeeting(meetingId, limit, skip)`: Meeting ke messages fetch karta hai aur sender ki details (`name`, `username`, `profilePicture`) populate karta hai.
- `softDelete(messageId, userId)`: Message ko soft delete karta hai.
- `updateById(messageId, data)`: Message update karta hai (Host moderation me use hota hai).
- `deleteAllByMeeting(meetingId)`: Jab host meeting end karta hai, toh privacy compliance ke liye meeting ke messages flush karta hai.

```javascript
class ChatRepository extends BaseRepository {
  createMessage(data) {
    return ChatMessage.create(data);
  }

  findByMeeting(meetingId, limit = 50, skip = 0) {
    return ChatMessage.find({ meeting: meetingId })
      .populate("sender", "name username profilePicture")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);
  }

  deleteAllByMeeting(meetingId) {
    return ChatMessage.deleteMany({ meeting: meetingId });
  }
}
```

---

### C. `services/chatService.js`
*Path:* `backend/src/services/chatService.js`

**Kaam:** Business rules, validation, aur authorization verify karta hai.
1. **`saveMessage(meetingId, userId, message)`**:
   - Check karta hai ki message empty toh nahi hai (`400`).
   - Check karta hai ki meeting exist karti hai ya nahi (`404`).
   - Repository ke through message save karta hai aur sender populate karke return karta hai.
2. **`deleteMessage(messageId, userId, meetingId)`**:
   - **Authorization Check:** Verify karta hai ki delete request karne wala user **Meeting ka Host** hai ya nahi (`meeting.host === userId`). Agar non-host delete kare toh `403 Forbidden` throw hota hai.
   - Message ko **Soft Delete** karta hai:
     ```javascript
     await chatRepo.updateById(messageId, {
       isDeleted: true,
       deletedBy: "host",
       message: "Message was deleted by host",
     });
     ```

---

### D. `socket/chatSocket.js`
*Path:* `backend/src/socket/chatSocket.js`

**Kaam:** Real-time WebSockets event handling via Socket.io.
User socket connection ke time authenticated hota hai (`socket.user.id`).

| Event In (Client ➔ Server) | Payload | Server Action | Event Out (Server ➔ Client Room) |
|---|---|---|---|
| `chat:send` | `{ meetingId, message }` | `chatService.saveMessage()` | `chat:message` -> (saved message) |
| `chat:typing` | `{ meetingId, isTyping }` | Broadcast to room except sender | `chat:user-typing` -> `{ userId, username, isTyping }` |
| `chat:delete` | `{ meetingId, messageId }` | `chatService.deleteMessage()` | `chat:message-deleted` -> `{ messageId, deletedBy: "host" }` |

**Code Snippet:**
```javascript
socket.on("chat:send", async ({ meetingId, message }) => {
  if (!meetingId || !message) return;
  try {
    const { message: savedMessage } = await chatService.saveMessage(
      meetingId,
      socket.user.id,
      message
    );
    // Meeting ke sabhi participants ko real-time push
    io.to(meetingId).emit("chat:message", savedMessage);
  } catch (error) {
    socket.emit("chat:error", { message: error.message });
  }
});
```

---

### E. Controller & Routes
*Paths:* `backend/src/controllers/chatController.js`, `backend/src/routes/chatRoutes.js`

REST API endpoint: `GET /api/meetings/:id/chat`
- Used on initial mount jab user room enter karta hai to load historical messages.
- Protected by `protect` middleware (JWT validation).

---

## 3. Frontend Deep Dive (File-by-File)

Frontend me **Zustand** reactive state management aur **Socket.io Client** use kiya gaya hai.

### A. `types/chat.ts`
TypeScript contracts define karta hai taaki type safety bani rahe:
- `ChatMessage`: `_id`, `meeting`, `sender`, `message`, `type`, `isDeleted`, `deletedBy`, `createdAt`.
- `ChatSender`: `_id`, `name`, `username`, `profilePicture`.
- `TypingUser`: `userId`, `username`.

---

### B. `services/chatService.ts`
Axios REST client ke through initial chat history fetch karta hai:
```typescript
export const getChatHistory = async (meetingId: string): Promise<ChatMessage[]> => {
  const response = await api.get(`/meetings/${meetingId}/chat`);
  return response.data.data.messages;
};
```

---

### C. `store/chatStore.ts` (Zustand Store)
*Path:* `frontend/src/store/chatStore.ts`

Global in-memory reactive store:
- `messages: ChatMessage[]`
- `typingUsers: Record<string, string>` (userId ➔ username)
- **`addMessage(message)`**: Duplicate check karta hai (`some(m => m._id === message._id)`). Agar unique ho toh append karta hai.
- **`removeMessage(messageId, deletedBy = "host")`**: Message ko delete nahi karta balki soft-update karta hai:
  ```typescript
  removeMessage: (messageId, deletedBy = "host") =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, deletedBy, message: "Message was deleted by host" }
          : m
      ),
    })),
  ```
- **`setTyping(userId, username, isTyping)`**: Typing state map update karta hai.
- **`clearChat()`**: Meeting leave karte waqt state clean karta hai memory leak avoid karne ke liye.

---

### D. `hooks/useChat.ts`
*Path:* `frontend/src/hooks/useChat.ts`

Yeh custom hook chat lifecycle manage karta hai:
1. **Mounting:** `getChatHistory(meetingId)` call karke REST API se purane messages load karta hai.
2. **Socket Listeners:**
   - `socket.on("chat:message", handleMessage)`
   - `socket.on("chat:message-deleted", handleDelete)`
   - `socket.on("chat:user-typing", handleTyping)`
3. **Cleanup:** Unmount hone par `socket.off(...)` aur `clearChat()` call karta hai.
4. **Helper Emitters:** `sendMessage(text)`, `deleteMessage(messageId)`, `sendTyping(isTyping)`.

---

### E. UI Components

#### 1. `ChatPanel.tsx` (Sidebar Layout)
- Meeting room ka right-docked dark glassmorphic panel (`bg-gray-900/95 backdrop-blur-xl border-l border-gray-800`).
- **Auto-scroll:** Naye messages par scroll to bottom karta hai (`scrollIntoView({ behavior: 'smooth' })`).
- **Smart Jump-to-bottom:** Agar user upar scroll karke purane messages padh raha ho, toh floating `↓ Latest` button show hota hai.
- **Empty State:** Glowing card with 3 interactive **Quick Greeting Chips** (*"👋 Hello everyone!"*, *"👍 Can everyone hear me?"*, *"🎉 Ready when you are!"*).

#### 2. `ChatMessage.tsx` (Bubble & Moderation)
- **Avatars:** User ke ID/name se deterministic gradient avatar generate hota hai.
- **Own vs Peer Bubble:**
  - Own: Right-aligned Blue-Indigo gradient (`from-blue-600 to-indigo-600`) with micro timestamp.
  - Peer: Left-aligned Dark slate surface (`bg-gray-800/90 border border-gray-700/60`).
- **Clickable Links:** Message me agar URL ho toh regular expression se auto-detect karke clickable link render hota hai.
- **Copy Message:** Hover par copy icon.
- **Moderation Action:**
  - Host ke liye hover par trash icon.
  - Non-blocking inline confirmation: `"Delete? [Yes] [No]"` (Calls `onDelete(message._id)`).
- **Deleted State:**
  - Jab message delete hota hai:
    `ShieldAlert` icon + text **`Message was deleted by host`**.
    Original sender ka avatar muted opacity me rehta hai taaki meeting me context maintain rahe.

#### 3. `ChatInput.tsx` (Input & Emoji Drawer)
- **Auto-expanding Textarea:** Text badhne par dynamically height adjust karta hai (max 120px).
- **Quick Emojis:** Smile button dabane par instant emoji drawer toggle hota hai (`👍`, `👏`, `❤️`, `😂`, `🎉`, `🔥`, `👋`, `🚀`, `💯`).
- **Typing Debouncing:** Input change par typing emit karta hai aur 1.5s idle ke baad automatic reset karta hai.
- **Keyboard Handling:** Enter dabane par send hota hai, Shift+Enter par newline.

#### 4. `TypingIndicator.tsx` (Wave Animation)
- Floating glassmorphic chip with 3 bouncing blue dots.
- Single user: *"Mohammad is typing"*.
- Multi-user: *"Mohammad and Sarah are typing"*.

---

## 4. Step-by-Step Execution Scenarios

### Scenario 1: Sending a Chat Message
1. User textarea me "Hello everyone!" type karke `Enter` press karta hai.
2. `ChatInput.tsx` me `handleSend()` trigger hota hai.
3. Callback `onSend("Hello everyone!")` ➔ `useChat.ts` me jata hai.
4. `useChat.ts` socket emit karta hai:
   `socket.emit("chat:send", { meetingId, message: "Hello everyone!" })`.
5. Backend me `chatSocket.js` message receive karta hai.
6. `chatService.saveMessage()` validation karta hai aur `chatRepo.createMessage()` MongoDB me insert karta hai.
7. MongoDB document create karke sender populate karta hai.
8. Server room me broadcast karta hai:
   `io.to(meetingId).emit("chat:message", savedMessage)`.
9. Sabhi clients ke `useChat.ts` par `chat:message` event trigger hota hai.
10. `chatStore.addMessage(savedMessage)` execute hota hai.
11. React components re-render hote hain aur `ChatPanel.tsx` smooth scroll down karta hai.

---

### Scenario 2: Typing Indicator (Debounced)
```
User Keystroke ──► isTypingRef = true ──► socket.emit("chat:typing", { isTyping: true })
      │
      └──► setTimeout(1500ms) ──► idle ──► socket.emit("chat:typing", { isTyping: false })
```
- **Fayda:** Har keystroke par socket flood hone se bachta hai; keval pehle stroke par emit hota hai aur 1.5s pause par clear hota hai.

---

### Scenario 3: Host Moderation (Message Delete)
1. Host kisi message par hover karke Trash icon par click karta hai.
2. Inline prompt show hota hai: `"Delete? [Yes] [No]"`.
3. Host `Yes` par click karta hai ➔ `onDelete(messageId)` call hota hai.
4. `useChat.ts` emit karta hai: `socket.emit("chat:delete", { meetingId, messageId })`.
5. Backend me `chatSocket.js` ➔ `chatService.deleteMessage()` execute hota hai.
6. **Security Check:** `meeting.host.toString() === userId.toString()`. Agar match na ho toh `403` error.
7. `chatRepo.updateById()` message ko soft-delete karta hai:
   `{ isDeleted: true, deletedBy: "host", message: "Message was deleted by host" }`.
8. Server broadcast karta hai: `io.to(meetingId).emit("chat:message-deleted", { messageId, deletedBy: "host" })`.
9. Sabhi users ke frontend me `chatStore.removeMessage()` trigger hota hai.
10. UI me message bubble instantly update ho jata hai:
    **`🛡️ Message was deleted by host`**.

---

## 5. Top Interview Questions & Answers

### Q1: Chat feature me REST API aur WebSockets dono kyu use kiye gaye hain?
> **Answer:**
> - **REST API (`GET /api/meetings/:id/chat`):** Reliable initial load aur pagination ke liye best hai. Jab user meeting join karta hai, toh ek structured HTTP request se purane messages fetch ho jaate hain with caching aur auth headers.
> - **WebSockets (`Socket.io`):** Ultra-low latency, bidirectional communication ke liye use hota hai. Naye messages, live typing status, aur host message deletion instantly sabhi room members ko bina polling ke push ho jate hain.

### Q2: Socket.io me room segregation kaise kaam karta hai?
> **Answer:**
> Jab user meeting me enter hota hai, backend par `socket.join(meetingId)` call hota hai. Chat messages bhejte waqt server `io.to(meetingId).emit(...)` use karta hai. Isse messages sirf usi meeting ke participants ko broadcast hote hain, dusre rooms ke data ke sath mix nahi hote.

### Q3: Soft Delete vs Hard Delete — Aapne Chat moderation me kya choose kiya aur kyu?
> **Answer:**
> Humne **Soft Delete** choose kiya. 
> - Hard delete karne par message DOM aur database se completely gayab ho jata hai, jisse dusre participants ko conversation context samajh nahi aata.
> - Soft delete me message document me `isDeleted: true` aur `deletedBy: "host"` set hota hai. Isse UI par professional notice aata hai: **"Message was deleted by host"** (like Slack, Teams, aur WhatsApp). Meeting end hone par privacy ke liye meeting-level hard delete (`deleteAllByMeeting`) call kiya jata hai.

### Q4: Network spam se bachne ke liye Typing Indicator kaise optimize kiya gaya hai?
> **Answer:**
> Frontend me `useRef` based debouncing logic use ki gayi hai:
> - Ek boolean ref (`isTypingRef`) track karta hai ki typing state already active hai ya nahi.
> - Pehli keystroke par `socket.emit("chat:typing", { isTyping: true })` emit hota hai.
> - Subsequent continuous typing par emit nahi hota, sirf 1.5 seconds ka timer reset hota hai.
> - Jab user 1.5s tak kuch type nahi karta ya message send karta hai, tab `isTyping: false` emit hota hai.

### Q5: Zustand store me duplicate message prevention kaise implement kiya gaya hai?
> **Answer:**
> WebSockets me network re-connect ya packet replay ke time duplicate message aane ka risk hota hai. Zustand ke `addMessage` action me `some()` check lagaya gaya hai:
> ```typescript
> addMessage: (message) =>
>   set((state) => {
>     const exists = state.messages.some((m) => m._id === message._id);
>     if (exists) return state;
>     return { messages: [...state.messages, message] };
>   }),
> ```
> Agar message ID already store me present ho, toh state mutate nahi hoti.

---
*Created for Mohammad • IntelliMeet Project Documentation*
