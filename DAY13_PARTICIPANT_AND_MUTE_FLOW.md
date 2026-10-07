# 🚀 IntelliMeet - Day 13: Live Participant List, Presence Indicators & Host Mute Controls

Is document me **Week 2 Day 13** ke sabhi features ka complete end-to-end flow detail me explain kiya gaya hai — Backend Socket & Room Manager se lekar Frontend Web Audio API, Zustand State, Custom Hooks aur UI Components tak.

---

## 📌 Table of Contents
1. [Day 13 Overview & Feature Set](#1-day-13-overview--feature-set)
2. [End-to-End Architecture & Flow Diagrams](#2-end-to-end-architecture--flow-diagrams)
   - [Flow 1: Host Single Participant Mute Flow](#-flow-1-host-single-participant-mute-flow)
   - [Flow 2: Host "Mute All" Broadcast Flow](#-flow-2-host-mute-all-broadcast-flow)
   - [Flow 3: Real-Time Active Speaker Detection (Web Audio API)](#-flow-3-real-time-active-speaker-detection-web-audio-api)
   - [Flow 4: Drawer Coordinated Toggle (People vs Chat)](#-flow-4-drawer-coordinated-toggle-people-vs-chat)
3. [Backend Deep Dive (File-by-File)](#3-backend-deep-dive-file-by-file)
   - [`backend/src/socket/meetingSocket.js`](#a-backendsrcsocketmeetingsocketjs)
   - [`backend/src/webrtc/roomManager.js`](#b-backendsrcwebrtcroommanagerjs)
4. [Frontend Deep Dive (File-by-File)](#4-frontend-deep-dive-file-by-file)
   - [`frontend/src/store/meetingStore.ts`](#a-frontendsrcstoremeetingstorets)
   - [`frontend/src/hooks/useActiveSpeaker.ts`](#b-frontendssrchooksuseactivespeakerts)
   - [`frontend/src/components/Meetings/VideoTile.tsx`](#c-frontendcomponentsmeetingsvideotilets)
   - [`frontend/src/components/Meetings/ParticipantList.tsx`](#d-frontendcomponentsmeetingsparticipantlisttsx)
   - [`frontend/src/pages/Meetings/MeetingRoom.tsx`](#e-frontendpagesmeetingsmeetingroomtsx)
5. [Socket Events Reference & Payloads](#5-socket-events-reference--payloads)
6. [Top Interview Questions & Technical Architecture Insights](#6-top-interview-questions--technical-architecture-insights)

---

## 1. Day 13 Overview & Feature Set

Day 13 ka core objective meeting me **Live Participant Management & Audio Moderation** system establish karna tha:

| Feature | Description |
| :--- | :--- |
| **Live Participant Sidebar** | Right drawer jo real-time joined users (local + remote peers) display karta hai with search filter & count badge. |
| **Presence Indicators** | Har user ke avatar par green online indicator dot (`bg-emerald-500`). |
| **Role Badges** | 👑 Host badge (Crown icon + gold badge) vs 👤 Member badge. |
| **Active Speaker Detection** | Web Audio API `AudioContext` & `AnalyserNode` ke zariye live volume track karke speaker ko highlight karna (Blue glow border, audio waveform, "Speaking" text). |
| **Host Moderation (Mute Participant)** | Host kisi bhi unmuted participant ko ek click me forcefully mute kar sakta hai. |
| **Host Moderation ("Mute All")** | Host ek single action me meeting ke sabhi non-host members ko safely mute kar sakta hai (Host immunity preserved). |
| **Safety & Fallback Preservation** | Day 12 ke sabhi features (Camera off avatar/picture fallback, Screen sharing filmstrip row, composite recording) 100% intact rakhe gaye hain. |

---

## 2. End-to-End Architecture & Flow Diagrams

### 🔄 Flow 1: Host Single Participant Mute Flow

```
[ HOST BROWSER ]                              [ NODE.JS BACKEND ]                           [ TARGET MEMBER BROWSER ]
       │                                              │                                                 │
       │ Host clicks Red Mute button                  │                                                 │
       │ on unmuted participant (Mohammad)            │                                                 │
       ├─────────────────────────────────────────────►│                                                 │
       │ socket.emit("meeting:mute-participant", {    │                                                 │
       │   meetingId, targetUserId                    │ 1. Verify: Is sender really Host?              │
       │ })                                           │    (Compare room.hostId / DB Host ID)           │
       │                                              │ 2. Find target socket in roomManager            │
       │                                              │ 3. Update room user state: isMuted = true       │
       │                                              │                                                 │
       │                                              │ Emit to target user's socket                    │
       │                                              ├────────────────────────────────────────────────►│
       │                                              │ socket.emit("meeting:force-mute")               │
       │                                              │                                                 │
       │                                              │                                                 │ 1. Get localStream audio tracks
       │                                              │                                                 │ 2. track.enabled = false
       │                                              │                                                 │ 3. setIsMuted(true)
       │                                              │                                                 │ 4. Show Toast: "🔇 Host muted you"
       │                                              │                                                 │ 5. Emit updated media state
       │                                              │◄────────────────────────────────────────────────┤
       │                                              │ socket.emit("meeting:media-state", {isMuted})   │
       │ Broadcast media state change to all peers    │                                                 │
       │◄─────────────────────────────────────────────┤                                                 │
       │ io.to(meetingId).emit(                       │                                                 │
       │   "meeting:media-state-changed",             │                                                 │
       │   { userId: targetUserId, isMuted: true }    │                                                 │
       │ )                                            │                                                 │
       │                                              │                                                 │
       ▼                                              ▼                                                 ▼
[ Host UI updates: Mohammad row shows red MicOff ]  [ In-memory state updated ]       [ Mohammad mic muted locally & globally ]
```

---

### 🔄 Flow 2: Host "Mute All" Broadcast Flow

```
[ HOST BROWSER ]                              [ NODE.JS BACKEND ]                           [ ALL NON-HOST MEMBERS ]
       │                                              │                                                 │
       │ Host clicks "Mute All" -> Confirms           │                                                 │
       ├─────────────────────────────────────────────►│                                                 │
       │ socket.emit("meeting:mute-all", {meetingId}) │ 1. Verify Host permission                       │
       │                                              │ 2. Loop through all room users:                 │
       │                                              │    - Skip Host socket                           │
       │                                              │    - Set user.isMuted = true                    │
       │                                              │    - Emit to user: "meeting:force-mute"         │
       │                                              ├────────────────────────────────────────────────►│ (To Member 1)
       │                                              ├────────────────────────────────────────────────►│ (To Member 2)
       │                                              │                                                 │
       │                                              │ Broadcast Room Event:                           │
       │                                              ├────────────────────────────────────────────────►│
       │                                              │ socket.to(meetingId).emit(                      │
       │                                              │   "meeting:force-mute-all"                      │
       │                                              │ )                                               │
       │                                              │                                                 │
       ▼                                              ▼                                                 ▼
[ Host remains unmuted! Toast: "Muted all" ]       [ All room user states updated ]     [ Audio tracks disabled + Toasts shown ]
```

---

### 🔄 Flow 3: Real-Time Active Speaker Detection (Web Audio API)

Client-side Audio Frequency Analysis pattern jo network bandwidth waste kiye bina 60fps par speaker identify karta hai:

```
[ Local / Peer MediaStream ]
          │
          ▼
 [ AudioContext Instance ]
          │
          ▼
[ createMediaStreamSource(stream) ]
          │
          ▼
[ AnalyserNode (fftSize: 256, smoothing: 0.4) ]
          │
          ▼ (requestAnimationFrame loop)
[ getByteFrequencyData(uint8Array) ]
          │
          ├──► Calculate Average Volume: avg = sum / length
          │
          ├──► Check Threshold: avg > SPEAKING_THRESHOLD (14)
          │
          ├──► Compare Max Volume among all participants
          │
          ▼
  If speaking:
    ├── Set lastSpokeTime = now
    └── setActiveSpeakerId(loudestUserId)
          │
  If silent:
    └── Keep highlighted for DECAY_MS (600ms) to prevent syllable flickering!
          │
          ▼
[ Zustand Store: activeSpeakerId ]
          │
   ┌──────┴──────────────────────────────────────┐
   ▼                                             ▼
[ VideoTile.tsx ]                        [ ParticipantList.tsx ]
- Blue Glowing Ring                      - Blue Glowing Avatar Ring
- 3-bar animated audio wave              - Animated "Speaking" Sound Wave
- `ring-2 ring-blue-500 shadow-md`       - Row highlighted: `bg-blue-950/30`
```

---

### 🔄 Flow 4: Drawer Coordinated Toggle (People vs Chat)

```
[ User clicks "People" button in Header ]
               │
               ▼
   isParticipantsOpen = true
   isChatOpen = false   ◄─── Chat panel smoothly unmounts (No overlapping!)
               │
               ▼
[ ParticipantList Sidebar renders ]
 - Shows active count badge (e.g. 5)
 - Displays (You) pinned at top
 - Displays peers with Presence dots & Mute buttons
```

---

## 3. Backend Deep Dive (File-by-File)

### 📄 a. `backend/src/socket/meetingSocket.js`

#### Role:
Meeting moderation events ko receive karna, Host authority verify karna, aur target sockets ko force commands bhejna.

#### Code Logic:
```javascript
// 1. Host Verification Helper
const isHostUser = async (meetingId, userId) => {
  const room = roomManager.getRoom(meetingId);
  if (room && room.hostId && String(room.hostId) === String(userId)) {
    return true;
  }
  const meeting = await meetingRepository.findById(meetingId);
  const hostId = meeting?.host?._id || meeting?.host;
  return hostId && String(hostId) === String(userId);
};

// 2. Individual Mute Event
socket.on("meeting:mute-participant", async ({ meetingId, targetUserId }) => {
  const isHost = await isHostUser(meetingId, socket.user?._id || socket.userId);
  if (!isHost) {
    return socket.emit("meeting:error", { message: "Only the meeting host can mute participants" });
  }

  const room = roomManager.getRoom(meetingId);
  if (room && room.users.has(targetUserId)) {
    const target = room.users.get(targetUserId);
    target.isMuted = true;

    // Send direct force mute signal to the targeted user's socket
    io.to(target.socketId).emit("meeting:force-mute", {
      mutedBy: socket.user?.name || "Host",
    });

    // Notify whole room about media state change
    io.to(meetingId).emit("meeting:media-state-changed", {
      userId: targetUserId,
      isMuted: true,
      isVideoOn: target.isVideoOn,
    });
  }
});

// 3. Mute All Event
socket.on("meeting:mute-all", async ({ meetingId }) => {
  const isHost = await isHostUser(meetingId, socket.user?._id || socket.userId);
  if (!isHost) {
    return socket.emit("meeting:error", { message: "Only host can mute all" });
  }

  const room = roomManager.getRoom(meetingId);
  if (room) {
    const currentUserId = (socket.user?._id || socket.userId)?.toString();
    room.users.forEach((userData, uId) => {
      // Host immunity: Host khud mute nahi hoga
      if (String(uId) !== currentUserId && String(uId) !== String(room.hostId)) {
        userData.isMuted = true;
        io.to(userData.socketId).emit("meeting:force-mute", {
          mutedBy: socket.user?.name || "Host",
        });
      }
    });

    // Broadcast force-mute-all to all non-host sockets
    socket.to(meetingId).emit("meeting:force-mute-all", {
      mutedBy: socket.user?.name || "Host",
    });
  }
});
```

---

### 📄 b. `backend/src/webrtc/roomManager.js`

#### Role:
Rooms aur participants ka in-memory state tracking (`room.users`, `room.hostId`, `room.activeScreenSharer`).

#### Code Logic:
`removeUserFromRoom` function ko improve kiya gaya taaki agar screen-share karne wala member leave kare, to server `wasScreenSharing` flag return kare, aur room me automatically `meeting:screen-share-stopped` broadcast ho jaye.

---

## 4. Frontend Deep Dive (File-by-File)

### 📄 a. `frontend/src/store/meetingStore.ts`

#### Role:
Application-wide meeting state management via Zustand.

#### Additions:
```typescript
interface MeetingStore {
  // ... existing states
  activeSpeakerId: string | null;
  setActiveSpeakerId: (id: string | null) => void;
}

// Added to Zustand create function:
activeSpeakerId: null,
setActiveSpeakerId: (id) => set({ activeSpeakerId: id }),

// Handled in resetMeeting():
resetMeeting: () => set({
  // ...
  activeSpeakerId: null,
})
```

---

### 📄 b. `frontend/src/hooks/useActiveSpeaker.ts`

#### Role:
Hardware audio level ko continuously monitor karta hai bina remote server par heavy audio packet bheje.

#### Deep Technical Logic:
1. **AudioContext Initialization**:
   Browser audio graph instantiate hota hai: `new AudioContext()`.
2. **Audio Track Attachment**:
   Local stream unmuted hone par `audioCtx.createMediaStreamSource(localStream)` banta hai. Peered remote streams ke unmuted audio tracks bhi connect hote hain.
3. **Volume Calculation & Anti-Flickering (600ms Decay Window)**:
   ```typescript
   analyser.getByteFrequencyData(dataArray as any);
   let sum = 0;
   for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
   const avg = sum / dataArray.length;

   if (avg > SPEAKING_THRESHOLD && avg > maxVolume) {
     maxVolume = avg;
     loudSpeakerId = id;
   }
   ```
   Jab speaker bolna band karta hai, 600ms ka hold window diya jata hai taaki do shabdon ke beech me visual border band-chalu hokar flicker na kare.
4. **Auto-Cleanup**:
   Muted users ya disconnected peers ke audio nodes cleanly `disconnect()` ho jaate hain memory leaks rokne ke liye.

---

### 📄 c. `frontend/src/components/Meetings/VideoTile.tsx`

#### Role:
Single participant ka video card render karta hai.

#### Features Added:
1. **Active Speaker Glow**:
   ```typescript
   isSpeaking && !isMuted ? "ring-2 ring-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.4)]" : ""
   ```
2. **3-Bar Animated Speaking Waveform**:
   ```tsx
   {isSpeaking && !isMuted && (
     <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
       <span className="w-1 h-2 bg-blue-400 rounded-full animate-pulse" />
       <span className="w-1 h-3 bg-blue-400 rounded-full animate-pulse [animation-delay:150ms]" />
       <span className="w-1 h-1.5 bg-blue-400 rounded-full animate-pulse [animation-delay:300ms]" />
     </span>
   )}
   ```

---

### 📄 d. `frontend/src/components/Meetings/ParticipantList.tsx`

#### Role:
Live Participant Drawer component.

#### Key Implementations:
1. **Online Presence Dot**:
   ```tsx
   <span
     className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-gray-900"
     title="Online"
   />
   ```
2. **Real-time Search Filter**:
   Name aur username par realtime filter: `filteredPeers = peers.filter(...)`.
3. **Host "Mute All" Action**:
   Top header me `Mute All ({count})` button with safety confirmation banner ("Mute all other participants? Cancel / Mute All Now").
4. **Smart Microphone Icon (User-requested UI Polish)**:
   - Default state me **Green Microphone Icon** (`text-emerald-400 bg-emerald-500/10 border-emerald-500/20`) dikhta hai.
   - Host jab us unmuted user ke mic par cursor le jata hai (`group-hover/mic`), icon smoothly red **`MicOff` (Mute button)** me transform ho jata hai:
     ```tsx
     <button
       onClick={() => onMuteParticipant(peer.userId, peer.name)}
       className="p-1 rounded-md bg-emerald-500/10 hover:bg-red-500/20 text-emerald-400 hover:text-red-400 border border-emerald-500/20 hover:border-red-500/30 transition-all group/mic cursor-pointer"
       title={`Click to mute ${peer.name}`}
     >
       <Mic className="w-3.5 h-3.5 group-hover/mic:hidden" />
       <MicOff className="w-3.5 h-3.5 hidden group-hover/mic:block" />
     </button>
     ```

---

### 📄 e. `frontend/src/pages/Meetings/MeetingRoom.tsx`

#### Role:
Main meeting orchestrator page.

#### Logic Wired:
1. **Force Mute Socket Event Listener**:
   ```typescript
   const handleForceMute = (data?: { mutedBy?: string }) => {
     if (isHost) return; // Host immunity protection
     if (localStream) {
       localStream.getAudioTracks().forEach((track) => {
         track.enabled = false;
       });
     }
     setIsMuted(true);
     socket.emit("meeting:media-state", {
       meetingId: id,
       isMuted: true,
       isVideoOn: useMeetingStore.getState().isVideoOn,
     });
     toast.info(`🔇 ${data?.mutedBy || "Meeting host"} muted your microphone`);
   };

   socket.on("meeting:force-mute", handleForceMute);
   socket.on("meeting:force-mute-all", handleForceMute);
   ```
2. **Top Header People Button**:
   Header me People button with count badge `peers.length + 1`.
3. **Mutual Drawer Toggle**:
   People open karne par Chat close hoti hai, aur Chat open karne par People close hoti hai.

---

## 5. Socket Events Reference & Payloads

| Event Name | Direction | Emitter | Receiver | Payload Schema | Action |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `meeting:mute-participant` | ➡️ C to S | Host Client | Server | `{ meetingId: string, targetUserId: string }` | Host requests server to mute a participant. |
| `meeting:force-mute` | ⬅️ S to C | Server | Target Socket | `{ mutedBy: string }` | Tells client hardware to disable audio track and update UI. |
| `meeting:mute-all` | ➡️ C to S | Host Client | Server | `{ meetingId: string }` | Host requests server to mute all non-host members. |
| `meeting:force-mute-all` | ⬅️ S to C | Server | Room Non-Host Sockets | `{ mutedBy: string }` | Broadcast to all non-host members to disable mic. |
| `meeting:media-state-changed`| ⬅️ S to C | Server | All Room Sockets | `{ userId: string, isMuted: boolean, isVideoOn: boolean }` | Keeps all participants' UI synchronized with latest peer states. |

---

## 6. Top Interview Questions & Technical Architecture Insights

### Q1. Why did we use Web Audio API (`AnalyserNode`) instead of sending audio packets or WebRTC stats?
**Ans:**
Agar hum audio volume detect karne ke liye har 100ms par server par WebSocket messages bhejte, to 10 users ki meeting me har second 100+ socket packets jaate, jisse backend traffic choke ho jata.
Web Audio API browser level par native C++ threads par audio buffer frequency analyze karta hai (0 network overhead, zero latency, 60fps smooth animations).

### Q2. How is Host Immunity enforced?
**Ans:**
Host Immunity 2 layers me secure ki gayi hai:
1. **Server-Side Enforcement**: `meetingSocket.js` me server `String(uId) !== currentUserId && String(uId) !== String(room.hostId)` check karta hai, isliye host socket par kabhi force mute emit nahi hota.
2. **Client-Side Defense**: `MeetingRoom.tsx` me `handleForceMute` ke andar `if (isHost) return;` guard check laga hai.

### Q3. When a user is forcefully muted, why do we disable the MediaStreamTrack instead of just changing UI state?
**Ans:**
Sirf UI me `isMuted: true` karne se user ki voice network par send hona band nahi hoti. Real privacy ke liye `localStream.getAudioTracks().forEach(t => t.enabled = false)` karna zaroori hota hai taaki WebRTC peer connection me actual microphone bytes physically cut ho jayein.

---

*IntelliMeet - Real-time Communication Platform Documentation*
