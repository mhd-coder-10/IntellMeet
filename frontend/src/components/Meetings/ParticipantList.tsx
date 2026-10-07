// Live Participant List Sidebar for MeetingRoom
// Displays active participants, host badges, presence indicators, active speaker highlights,
// media statuses (mic, camera, screen share), and host moderation controls (Mute Participant, Mute All).

import { useState, useMemo } from "react";
import {
  Users,
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Crown,
  Volume2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoPeer } from "@/types/meeting";

interface CurrentUserInfo {
  id: string;
  name: string;
  profilePicture?: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isHost: boolean;
}

interface ParticipantListProps {
  currentUser: CurrentUserInfo;
  peers: VideoPeer[];
  meetingHostId?: string;
  screenSharingUserId: string | null;
  isSpeaking: (userId: string) => boolean;
  onMuteParticipant: (userId: string, name: string) => void;
  onMuteAll: () => void;
  onClose: () => void;
}

export function ParticipantList({
  currentUser,
  peers,
  meetingHostId,
  screenSharingUserId,
  isSpeaking,
  onMuteParticipant,
  onMuteAll,
  onClose,
}: ParticipantListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showMuteAllConfirm, setShowMuteAllConfirm] = useState(false);

  // Total count of participants (you + remote peers)
  const totalCount = 1 + peers.length;

  // Filter peers by search query
  const filteredPeers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q))
    );
  }, [peers, searchQuery]);

  // Check if current user matches search query
  const isCurrentUserMatched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return currentUser.name.toLowerCase().includes(q);
  }, [currentUser.name, searchQuery]);

  // Count unmuted non-host peers
  const unmutedPeersCount = useMemo(() => {
    return peers.filter(
      (p) =>
        !p.isMuted &&
        String(p.userId) !== String(meetingHostId) &&
        String(p.userId) !== String(currentUser.id)
    ).length;
  }, [peers, meetingHostId, currentUser.id]);

  const handleConfirmMuteAll = () => {
    onMuteAll();
    setShowMuteAllConfirm(false);
  };

  return (
    <div className="w-80 sm:w-96 flex-shrink-0 border-l border-gray-800/80 bg-gray-900/95 backdrop-blur-xl flex flex-col h-full shadow-2xl relative z-20 text-gray-100 select-none">
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
            <Users className="h-4 w-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-gray-100 tracking-tight">
                Participants
              </h2>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700/60">
                {totalCount}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {currentUser.isHost ? "Host Moderation Active" : "In this meeting"}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Host Moderation Controls: "Mute All" Action */}
      {currentUser.isHost && (
        <div className="p-3 border-b border-gray-800/80 bg-gray-900/50">
          {!showMuteAllConfirm ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-300">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-gray-400 text-[11px]">Host Control:</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMuteAllConfirm(true)}
                disabled={unmutedPeersCount === 0}
                className="h-7 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border-red-500/30 disabled:opacity-40 disabled:hover:bg-red-500/10"
              >
                <MicOff className="w-3 h-3 mr-1.5 text-red-400" />
                Mute All
                {unmutedPeersCount > 0 && ` (${unmutedPeersCount})`}
              </Button>
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              <p className="text-xs text-red-200 mb-2">
                Mute all other participants in this meeting?
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowMuteAllConfirm(false)}
                  className="h-6 px-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmMuteAll}
                  className="h-6 px-2.5 text-xs bg-red-600 hover:bg-red-700 text-white border-none"
                >
                  Mute All Now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Input Filter */}
      <div className="p-3 border-b border-gray-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full bg-gray-800/70 border border-gray-700/60 rounded-lg pl-8 pr-8 py-1.5 text-xs text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Participants Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800">
        {/* Local User Row (Pinned at top if matches search) */}
        {isCurrentUserMatched && (
          <div
            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
              isSpeaking(currentUser.id) && !currentUser.isMuted
                ? "bg-blue-950/30 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                : "bg-gray-800/40 border-gray-800/60 hover:bg-gray-800/70"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Avatar with Online Presence Dot & Speaking Ring */}
              <div className="relative shrink-0">
                {currentUser.profilePicture ? (
                  <img
                    src={currentUser.profilePicture}
                    alt={currentUser.name}
                    className={`w-9 h-9 rounded-full object-cover ${
                      isSpeaking(currentUser.id) && !currentUser.isMuted
                        ? "ring-2 ring-blue-500 shadow-xs"
                        : "ring-1 ring-gray-700"
                    }`}
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs ${
                      isSpeaking(currentUser.id) && !currentUser.isMuted
                        ? "ring-2 ring-blue-500 shadow-xs"
                        : "ring-1 ring-gray-700"
                    }`}
                  >
                    {(currentUser.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online Presence Indicator */}
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-gray-900"
                  title="Online"
                />
              </div>

              {/* Name & Role Badges */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-100 truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 font-normal">
                    (You)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  {currentUser.isHost ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                      <Crown className="w-2.5 h-2.5 text-amber-400" />
                      Host
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[9px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
                      Member
                    </span>
                  )}

                  {isSpeaking(currentUser.id) && !currentUser.isMuted && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 font-medium">
                      <Volume2 className="w-2.5 h-2.5 animate-pulse" />
                      Speaking
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Media Status Icons */}
            <div className="flex items-center gap-2 shrink-0">
              {currentUser.isScreenSharing && (
                <div
                  className="p-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  title="Sharing screen"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </div>
              )}

              {currentUser.isVideoOn ? (
                <div
                  className="p-1 rounded bg-gray-800 text-gray-300"
                  title="Camera on"
                >
                  <Video className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div
                  className="p-1 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                  title="Camera off"
                >
                  <VideoOff className="w-3.5 h-3.5" />
                </div>
              )}

              {currentUser.isMuted ? (
                <div
                  className="p-1 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                  title="Muted"
                >
                  <MicOff className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div
                  className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  title="Mic on"
                >
                  <Mic className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remote Peers List */}
        {filteredPeers.map((peer) => {
          const peerIsHost =
            meetingHostId && String(meetingHostId) === String(peer.userId);
          const isPeerScreenSharing =
            screenSharingUserId &&
            String(screenSharingUserId) === String(peer.userId);
          const speaking = isSpeaking(peer.userId) && !peer.isMuted;

          return (
            <div
              key={peer.userId}
              className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                speaking
                  ? "bg-blue-950/30 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "bg-gray-800/30 border-gray-800/60 hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar with Presence Indicator */}
                <div className="relative shrink-0">
                  {peer.profilePicture ? (
                    <img
                      src={peer.profilePicture}
                      alt={peer.name}
                      className={`w-9 h-9 rounded-full object-cover ${
                        speaking
                          ? "ring-2 ring-blue-500 shadow-xs"
                          : "ring-1 ring-gray-700"
                      }`}
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full bg-blue-700/80 flex items-center justify-center text-white font-semibold text-xs ${
                        speaking
                          ? "ring-2 ring-blue-500 shadow-xs"
                          : "ring-1 ring-gray-700"
                      }`}
                    >
                      {(peer.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Online Presence Dot */}
                  <span
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-gray-900"
                    title="Online"
                  />
                </div>

                {/* Name & Role Badges */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-100 truncate">
                      {peer.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    {peerIsHost ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                        <Crown className="w-2.5 h-2.5 text-amber-400" />
                        Host
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
                        Member
                      </span>
                    )}

                    {speaking && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 font-medium">
                        <Volume2 className="w-2.5 h-2.5 animate-pulse" />
                        Speaking
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Media Controls & Indicators */}
              <div className="flex items-center gap-2 shrink-0">
                {isPeerScreenSharing && (
                  <div
                    className="p-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    title="Sharing screen"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </div>
                )}

                {peer.isVideoOn ? (
                  <div
                    className="p-1 rounded bg-gray-800 text-gray-300"
                    title="Camera on"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div
                    className="p-1 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                    title="Camera off"
                  >
                    <VideoOff className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Mic Status / Host Mute Action */}
                {peer.isMuted ? (
                  <div
                    className="p-1 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                    title="Muted"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                ) : currentUser.isHost && !peerIsHost ? (
                  /* Host can mute this active participant: shows green Mic icon by default, hover transitions to red Mute */
                  <button
                    onClick={() => onMuteParticipant(peer.userId, peer.name)}
                    className="p-1 rounded-md bg-emerald-500/10 hover:bg-red-500/20 text-emerald-400 hover:text-red-400 border border-emerald-500/20 hover:border-red-500/30 transition-all group/mic cursor-pointer"
                    title={`Click to mute ${peer.name}`}
                  >
                    <Mic className="w-3.5 h-3.5 group-hover/mic:hidden" />
                    <MicOff className="w-3.5 h-3.5 hidden group-hover/mic:block" />
                  </button>
                ) : (
                  <div
                    className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    title="Mic on"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty Search State */}
        {!isCurrentUserMatched && filteredPeers.length === 0 && (
          <div className="py-8 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p className="text-xs text-gray-300">No participants found</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              No results match "{searchQuery}"
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 border-t border-gray-800/80 bg-gray-900/60 text-[11px] text-gray-400 flex items-center justify-between">
        <span>Total: {totalCount} {totalCount === 1 ? "person" : "people"}</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live sync
        </span>
      </div>
    </div>
  );
}
