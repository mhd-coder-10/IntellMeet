# 🚀 IntelliMeet - Complete Media Lifecycle & Cloudinary Cleanup Architecture Guide

Is document me **IntelliMeet ke Media Files Lifecycle Management (Cloudinary & Local Disk Cleanup, Host Deletion vs Participant Remove, and User Profile Picture Replacement/Removal)** ka complete end-to-end coding workflow explain kiya gaya hai — Backend models, services, repositories se lekar Frontend UI indicators aur error handling tak.

Yeh guide production architecture understanding aur interview preparation dono ke liye designed hai.

---

## 📌 Table of Contents
1. [Core Problem Statement & Requirements](#1-core-problem-statement--requirements)
2. [High-Level Architecture & Lifecycle Flowcharts](#2-high-level-architecture--lifecycle-flowcharts)
   - [A. Host Meeting Deletion Workflow](#a-host-meeting-deletion-workflow)
   - [B. Participant Meeting Removal (Hide) Workflow](#b-participant-meeting-removal-hide-workflow)
   - [C. User Profile Picture (Avatar) Lifecycle](#c-user-profile-picture-avatar-lifecycle)
3. [Deep Dive: Centralized Media Utility (`mediaStorage.js`)](#3-deep-dive-centralized-media-utility-mediastoragejs)
   - [Cloudinary Public ID Extraction Algorithm](#cloudinary-public-id-extraction-algorithm)
   - [Resource Type Detection (`image` vs `video`)](#resource-type-detection-image-vs-video)
   - [Unified `deleteMediaFile` & `uploadToCloudinary`](#unified-deletemediafile--uploadtocloudinary)
4. [Backend Code Deep Dive (File-by-File)](#4-backend-code-deep-dive-file-by-file)
   - [Meeting Model (`models/Meeting.js`)](#a-modelsmeetingjs)
   - [Meeting Service (`services/meetingService.js`)](#b-servicesmeetingservicejs)
   - [User Service (`services/userService.js`)](#c-servicesuserservicejs)
5. [Frontend Code Deep Dive (File-by-File)](#5-frontend-code-deep-dive-file-by-file)
   - [TypeScript Contract (`types/meeting.ts`)](#a-typesmeetingts)
   - [Meeting Details Page (`MeetingDetails.tsx`)](#b-pagesmeetingsmeetingdetailstsx)
6. [Host Delete vs Participant Remove (Comparison Matrix)](#6-host-delete-vs-participant-remove-comparison-matrix)
7. [Top Interview Questions & Answers](#7-top-interview-questions--answers)

---

## 1. Core Problem Statement & Requirements

Video conferencing apps me real-time media files (Recordings, Avatars, Attachments) heavy cloud resources consume karti hain:

1. **Storage Orphan Problem:** Agar user profile picture change kare ya host meeting delete kare, aur humne Cloudinary se file delete nahi ki, toh cloud bill badhta rahega aur storage bloated ho jayegi.
2. **Participant Data Integrity Rule:** 
   - Agar koi **Participant** apne dashboard se meeting "Remove" karta hai, toh **recording aur meeting details Cloudinary ya Database se delete NAHI honi chahiye**. Sirf us specific participant ke dashboard se hide honi chahiye.
3. **Host Deletion Rule:**
   - Jab **Host** meeting delete karta hai, toh meeting ki **recording file Cloudinary aur local disk se permanently delete ho jani chahiye**.
   - Par jin participants ne meeting attend ki thi, unke dashboard ya meeting details page me meeting metadata (date, duration, attendees) preserve rahega, aur recording card par clear notice aayega:
     > **"Recording deleted by the host"**
4. **Avatar Lifecycle Rule:**
   - Profile photo **update** hone par purani photo Cloudinary se delete hogi aur nayi photo replace hogi.
   - Profile photo **remove** hone par Cloudinary aur MongoDB dono se permanently wipe out hogi.

---

## 2. High-Level Architecture & Lifecycle Flowcharts

### A. Host Meeting Deletion Workflow

```
[ HOST CLICKS "DELETE MEETING" ]
              │
              ▼
    [ DELETE /api/meetings/:id ]
              │
              ▼
   [ meetingService.deleteMeeting ]
              │
  ┌───────────┴───────────────────────────────────────────┐
  │ 1. Verify Host Authority (meeting.host === userId)   │
  │ 2. If meeting.recordingUrl:                           │
  │    └── deleteMediaFile(recordingUrl) ─────────────────┼──► [ Cloudinary API ]
  │        (Calls destroy with resource_type: "video")    │    (Video Permanently Destroyed)
  │ 3. Clear Chat Messages (deleteAllByMeeting)           │
  └───────────────────┬───────────────────────────────────┘
                      │
            Are there Participants?
             (participants.length > 0 || completed)
                      │
        ┌─────────────┴─────────────┐
        ▼ YES                       ▼ NO (Empty draft meeting)
  ┌─────────────────────────┐  ┌─────────────────────────┐
  │ Soft Delete for Host:   │  │ Hard Delete:            │
  │ • isHostDeleted = true  │  │ meetingRepo.deleteById  │
  │ • recordingUrl = ""     │  └─────────────────────────┘
  │ • recordingDeletedByHost│
  │   = true                │
  │ • hostDeletedAt = now   │
  └───────────┬─────────────┘
              │
  ┌───────────┴─────────────────────────────┐
  │ Redis Cache Invalidated (meeting:* &    │
  │ user:*:meetings)                        │
  └───────────────────┬─────────────────────┘
                      │
        ┌─────────────┴────────────────────────────────┐
        ▼                                              ▼
 [ HOST'S DASHBOARD ]                       [ PARTICIPANT'S DASHBOARD ]
  Query Filter:                              Query Filter:
  { host: userId, isHostDeleted: {$ne: true}} User is in participants/attended
  Meeting disappears completely              Meeting STAYS in list
                                                       │
                                                       ▼
                                            [ Participant clicks "Details" ]
                                                       │
                                                       ▼
                                            [ MeetingDetails.tsx ]
                                            • Title, Date, StartedAt, EndedAt: Visible
                                            • Recording Box:
                                              ⚠️ "Recording deleted by the host"
```

---

### B. Participant Meeting Removal (Hide) Workflow

```
[ PARTICIPANT CLICKS "REMOVE FROM DASHBOARD" ]
                     │
                     ▼
       [ DELETE /api/meetings/:id/hide ]
                     │
                     ▼
     [ meetingService.hideMeetingFromUser ]
                     │
                     ▼
      [ userRepo.addHiddenMeeting ]
  User.hiddenMeetings.push(meetingId) via $addToSet
                     │
   ┌─────────────────┴──────────────────┐
   │ ❌ NO Cloudinary Deletion          │
   │ ❌ NO Meeting Document Deletion    │
   │ ❌ NO Recording Removal            │
   └─────────────────┬──────────────────┘
                     │
                     ▼
  • That participant can no longer see meeting on their dashboard.
  • Host and ALL OTHER participants continue to have full access!
```

---

### C. User Profile Picture (Avatar) Lifecycle

```
[ USER SELECTS NEW PROFILE PHOTO ]           [ USER CLICKS "REMOVE PHOTO" ]
               │                                            │
               ▼                                            ▼
      PUT /api/users/avatar                       DELETE /api/users/avatar
               │                                            │
               ▼                                            ▼
    [ userService.updateAvatar ]                 [ userService.removeAvatar ]
               │                                            │
 1. Check if user.profilePicture exists       1. Check if user.profilePicture exists
               │                                            │
               ▼                                            ▼
     deleteMediaFile(oldUrl)                      deleteMediaFile(oldUrl)
  (Extracts publicId, destroys                 (Extracts publicId, destroys
   from Cloudinary with type: "image")          from Cloudinary with type: "image")
               │                                            │
 2. Upload new photo to Cloudinary            2. Update MongoDB User:
    uploadToCloudinary(fileBuffer)               userRepo.removeAvatar(userId)
               │                                 profilePicture = ""
 3. Update MongoDB User:                                    │
    profilePicture = result.secure_url                      ▼
               │                                  Response 200: { user }
               ▼                                  Default initial badge shown
     Response 200: { user }                       in UI instantly
```

---

## 3. Deep Dive: Centralized Media Utility (`mediaStorage.js`)

*File:* [`backend/src/utils/mediaStorage.js`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/utils/mediaStorage.js)

Pehle har service apna alag regex aur incomplete destruction method likh rahi thi. Humne ek centralized utility banayi jo sabhi cases handle karti hai.

### Cloudinary Public ID Extraction Algorithm
Cloudinary URLs nested subfolders, versions aur transformation parameters ke saath aate hain:
- Example: `https://res.cloudinary.com/ipb9jst1/video/upload/c_scale,w_500/v1743934823/IntellMeet_prs/recordings/rec_92384.webm`

```javascript
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + "/upload/".length);
    pathAfterUpload = pathAfterUpload.split("?")[0].split("#")[0];

    const segments = pathAfterUpload.split("/");
    const validSegments = [];

    for (const segment of segments) {
      if (!segment) continue;

      // 1. Skip Version tag (e.g. "v1743934823")
      if (/^v\d+$/.test(segment)) continue;

      // 2. Skip Transformation tags (e.g. "c_fill,w_300" or short flags)
      if (
        segment.includes(",") ||
        /^(?:[a-z]{1,2}_|e_|fl_|o_|bo_)[a-zA-Z0-9_,-]+$/.test(segment)
      ) {
        continue;
      }

      validSegments.push(segment);
    }

    if (validSegments.length === 0) return null;

    // 3. Join folder + filename and strip extension (.webm, .jpg, etc.)
    const fullPath = validSegments.join("/");
    return fullPath.replace(/\.[a-zA-Z0-9]+$/, "");
  } catch (err) {
    return null;
  }
};
```
👉 **Output:** `IntellMeet_prs/recordings/rec_92384`

---

### Resource Type Detection (`image` vs `video`)
Cloudinary API me sabse bada pitfall yeh hota hai ki agar aap video file ko default `resource_type: "image"` se destroy karenge, toh Cloudinary `{ result: "not found" }` return karta hai aur file delete nahi hoti!
Audio aur Video dono Cloudinary me `"video"` category me aate hain:

```javascript
const detectResourceType = (url) => {
  if (!url || typeof url !== "string") return "image";
  const lower = url.toLowerCase();

  if (lower.includes("/video/upload/")) return "video";
  if (lower.includes("/raw/upload/")) return "raw";
  if (lower.includes("/image/upload/")) return "image";

  if (/\.(webm|mp4|mov|mkv|avi|flv|m4v|mp3|wav|ogg|aac|m4a)$/i.test(lower)) {
    return "video";
  }

  if (/\.(pdf|zip|tar|gz|txt|doc|docx)$/i.test(lower)) {
    return "raw";
  }

  return "image";
};
```

---

### Unified `deleteMediaFile` & `uploadToCloudinary`
Yeh function Cloudinary aur local disk (`/uploads/...`) dono ko automatically handle karta hai:

```javascript
const deleteMediaFile = async (url) => {
  if (!url || typeof url !== "string") {
    return { success: false, reason: "No media URL provided" };
  }

  // Case 1: Cloudinary Storage
  if (url.includes("cloudinary.com")) {
    try {
      const publicId = extractPublicId(url);
      if (!publicId) return { success: false, reason: "Invalid Public ID" };

      const resourceType = detectResourceType(url);
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      // Fallback: If not found, attempt opposite resource type
      if (result && result.result === "not found") {
        const fallbackType = resourceType === "video" ? "image" : "video";
        await cloudinary.uploader.destroy(publicId, {
          resource_type: fallbackType,
          invalidate: true,
        });
      }

      return { success: true, provider: "cloudinary", publicId };
    } catch (err) {
      console.error("[MediaStorage] Cloudinary delete failed:", err.message);
      return { success: false, error: err.message };
    }
  }

  // Case 2: Local Disk Storage (/uploads/...)
  if (url.includes("/uploads/")) {
    try {
      const uploadIdx = url.indexOf("/uploads/");
      const relativeSubpath = url.substring(uploadIdx + "/uploads/".length);
      const filePath = path.join(__dirname, "../../uploads", relativeSubpath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true, provider: "local", filePath };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, reason: "Unrecognized storage" };
};
```

---

## 4. Backend Code Deep Dive (File-by-File)

### A. `models/Meeting.js`
*File:* [`backend/src/models/Meeting.js`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/models/Meeting.js#L60-L76)

Humne schema me 3 new fields add kiye:
```javascript
recordingDeletedByHost: {
    type: Boolean,
    default: false,
},
isHostDeleted: {
    type: Boolean,
    default: false,
},
hostDeletedAt: {
    type: Date,
    default: null,
},
```

---

### B. `services/meetingService.js`
*File:* [`backend/src/services/meetingService.js`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/services/meetingService.js)

#### 1. Host Meeting Deletion (`deleteMeeting`):
```javascript
const deleteMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can delete the meeting");
    error.statusCode = 403;
    throw error;
  }

  // 1. Permanently delete recording file from Cloudinary and local disk
  if (meeting.recordingUrl) {
    await deleteMediaFile(meeting.recordingUrl);
  }

  // 2. Clear chat messages for this meeting
  const chatRepo = require("../repositories/chatRepository");
  await chatRepo.deleteAllByMeeting(meetingId);

  // 3. Check if any participants attended / joined this meeting
  const hasParticipants =
    (meeting.participants && meeting.participants.length > 0) ||
    meeting.status === "completed";

  if (hasParticipants) {
    // Keep meeting document for attendees to view meeting metadata and "Recording deleted by the host" notice.
    // Mark as host-deleted and wipe recordingUrl so host will no longer see it on their dashboard.
    await meetingRepo.updateById(meetingId, {
      recordingUrl: "",
      recordingDeletedByHost: true,
      isHostDeleted: true,
      hostDeletedAt: new Date(),
    });
  } else {
    // If no other user ever attended or joined, permanently delete document from DB
    await meetingRepo.deleteById(meetingId);
  }

  await clearMeetingCaches(meetingId, userId);
  return { message: "Meeting deleted successfully" };
};
```

#### 2. User Dashboard Meetings Query (`getUserMeetings`):
Host ke liye deleted meetings hide hoti hain, jabki attendees ke liye visible rehti hain:
```javascript
  const meetings = await Meeting.find({
    $and: [
      {
        $or: [
          // User is host, and meeting is NOT host-deleted
          { host: userId, isHostDeleted: { $ne: true } },
          // User is participant / attended (even if host deleted it, participant can still see it unless hidden)
          {
            $and: [
              { host: { $ne: userId } },
              {
                $or: [
                  { participants: userId },
                  { _id: { $in: visibleAttendedIds } },
                ],
              },
            ],
          },
        ],
      },
      { _id: { $nin: hiddenIds } },
    ],
  })
```

#### 3. Meeting Details Security (`getMeetingById`):
Agar host khud deleted meeting open karne ki koshish kare, toh use 404 milta hai. Lekin attendees ko meeting details milti hain with `recordingDeletedByHost: true`:
```javascript
  if (
    userId &&
    meeting.isHostDeleted &&
    (meeting.host?._id?.toString() === userId.toString() ||
      meeting.host?.toString() === userId.toString())
  ) {
    const error = new Error("Meeting not found or was deleted by you");
    error.statusCode = 404;
    throw error;
  }
```

---

### C. `services/userService.js`
*File:* [`backend/src/services/userService.js`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/backend/src/services/userService.js#L50-L115)

Avatar update aur remove me `deleteMediaFile` ka use kiya gaya hai:
```javascript
const updateAvatar = async (userId, fileBuffer) => {
  const user = await userRepo.findById(userId);
  ...
  // 1. Delete old avatar from Cloudinary or disk
  if (user.profilePicture) {
    await deleteMediaFile(user.profilePicture);
  }

  // 2. Upload new avatar
  const result = await uploadToCloudinary(fileBuffer, { subfolder: "avatars", resource_type: "image" });
  const updated = await userRepo.updateAvatar(userId, result.secure_url);
  return { user: updated };
};

const removeAvatar = async (userId) => {
  const user = await userRepo.findById(userId);
  ...
  // 1. Delete avatar from Cloudinary or disk
  await deleteMediaFile(user.profilePicture);

  // 2. Clear from database
  const updated = await userRepo.removeAvatar(userId);
  return { user: updated };
};
```

---

## 5. Frontend Code Deep Dive (File-by-File)

### A. `types/meeting.ts`
*File:* [`frontend/src/types/meeting.ts`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/types/meeting.ts#L18-L26)

```typescript
export interface Meeting {
    _id: string
    title: string
    description?: string
    host: MeetingParticipant
    participants: MeetingParticipant[]
    meetingCode: string
    scheduledAt: string
    startedAt?: string | null
    endedAt?: string | null
    recordingUrl?: string
    isRecording?: boolean
    recordingDeletedByHost?: boolean // 👈 NEW
    isHostDeleted?: boolean          // 👈 NEW
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
    settings: { ... }
}
```

---

### B. `pages/Meetings/MeetingDetails.tsx`
*File:* [`frontend/src/pages/Meetings/MeetingDetails.tsx`](file:///d:/MY/3_PROJECT_DOC/INTELLMEET_PR1/frontend/src/pages/Meetings/MeetingDetails.tsx#L324-L390)

Jab `meeting.recordingDeletedByHost === true` ho, toh:
1. Header me status badge aati hai: **`Recording Deleted by Host`** (Amber styling).
2. Download button automatically hide ho jata hai (broken URL link prevention).
3. Recording card me sleek warning state render hoti hai with `VideoOff` aur `AlertTriangle`:

```tsx
{meeting.recordingDeletedByHost ? (
  <div className="py-12 px-6 text-center space-y-3.5 max-w-lg mx-auto">
    <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/90 shadow-xs">
      <VideoOff className="w-8 h-8" />
    </div>
    <div className="space-y-1.5">
      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide">
        <AlertTriangle className="w-3 h-3" />
        Notice
      </div>
      <h4 className="text-base font-bold text-slate-900">
        Recording deleted by the host
      </h4>
      <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
        The host has permanently removed this recording file from the cloud server and database. Session details and attendee history remain accessible for your reference.
      </p>
    </div>
  </div>
) : meeting.recordingUrl ? (
  <video src={meeting.recordingUrl} controls ... />
) : (
  <p>No recording captured for this session</p>
)}
```

---

## 6. Host Delete vs Participant Remove (Comparison Matrix)

| Criteria | Host Deletes Meeting (`DELETE /meetings/:id`) | Participant Removes Meeting (`DELETE /meetings/:id/hide`) |
| :--- | :--- | :--- |
| **Endpoint Called** | `DELETE /api/meetings/:id` | `DELETE /api/meetings/:id/hide` |
| **Cloudinary Media Action** | **Destroyed Immediately** (`deleteMediaFile(recordingUrl)`) | **No Action Taken** (Media preserved) |
| **Local Disk Storage** | **Unlinked immediately** (`fs.unlinkSync`) | **No Action Taken** |
| **MongoDB Meeting Record** | Marked `isHostDeleted: true`, `recordingUrl: ""` (or deleted if no attendees) | Unchanged |
| **Host Dashboard Visibility** | **Hidden Completely** from Host's dashboard | Remains fully visible for Host |
| **Participant Dashboard** | **Still Visible** in attended history | **Hidden** only for the user who hid it (`hiddenMeetings`) |
| **Meeting Details Page** | Host gets 404. Attendees see: **"Recording deleted by the host"** | Other participants still see full details & recording |

---

## 7. Top Interview Questions & Answers

### Q1: Cloudinary me video files delete karte waqt sabse common bug kya hota hai?
**Answer:**
Cloudinary Node SDK me `cloudinary.uploader.destroy(publicId)` ka default `resource_type` **`"image"`** hota hai. Jab aap `.webm` ya `.mp4` video ya audio file delete karte hain bina `{ resource_type: "video" }` pass kiye, Cloudinary use image bucket me search karta hai aur silent error `{ result: "not found" }` return karta hai. Result yeh hota hai ki backend code 200 success bhej deta hai, par video cloud storage me zinda rehta hai.
*Solution:* Centralized utility me `detectResourceType(url)` likha jo extension ya URL pattern dekh kar explicitly `{ resource_type: "video" }` bhejta hai, sath hi fail hone par fallback type retry karta hai.

---

### Q2: Host meeting delete kare toh hum meeting document ko MongoDB se seedha `deleteOne()` kyu nahi karte?
**Answer:**
Agar host ne meeting delete ki aur humne document MongoDB se hard delete kar diya, toh meeting me shamil hone wale 20 participants ke records corrupt ho jayenge. Unke dashboard par 404 error aane lagega ya unka attendance history chala jayega.
Isliye hum **Smart Soft-Partitioning** use karte hain:
1. Physical heavy file (recording video) ko Cloudinary aur Disk se turant delete karte hain taaki storage cost zero ho jaye.
2. Host ke liye `isHostDeleted: true` mark karte hain taaki host ke dashboard par woh dikhe hi nahi.
3. Participants ke liye metadata (title, start/end time, duration) intact rehta hai, aur recording slot par **"Recording deleted by the host"** display hota hai.

---

### Q3: Agar user Google OAuth ya external avatar use kar raha ho aur profile update kare, toh Cloudinary crash se kaise bachte hain?
**Answer:**
`deleteMediaFile(url)` me sabse pehle URL provider validation check hoti hai:
- Agar URL me `cloudinary.com` nahi hai aur na hi `/uploads/` hai (e.g. `lh3.googleusercontent.com` ya external gravatar), toh utility bina kisi crash ke safely return kar deti hai (`{ success: false, reason: "Unrecognized media URL" }`). Koi invalid API call trigger nahi hoti.

---

### Q4: Nested subfolders wale Cloudinary URLs se public_id kaise reliably extract hoti hai?
**Answer:**
Cloudinary URL me folder structure (`IntellMeet_prs/avatars/abc123.jpg`) hota hai. Agar hum sirf last segment lenge toh folder name choot jayega.
Humara algorithm:
1. `/upload/` ke baad ka pura path leta hai.
2. Version tag (`v1743934823`) aur transformations (`c_fill,w_300`) ko regex se strip karta hai.
3. Jo bachta hai wahi complete hierarchical publicId hota hai bina extension ke (`IntellMeet_prs/avatars/abc123`).

---

### Q5: Is pure system me Redis caching ka role kya hai?
**Answer:**
Jab meeting delete ya update hoti hai, toh purana cached payload Redis me na rahe iske liye `clearMeetingCaches(meetingId, hostId)` trigger hota hai jo `meeting:${meetingId}*` aur `user:*:meetings` patterns ke sabhi cache keys ko atomically flush kar deta hai. Isse race conditions aur stale UI data completely prevent ho jata hai.
