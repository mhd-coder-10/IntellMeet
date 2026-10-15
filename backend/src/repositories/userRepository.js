const BaseRepository = require("./baseRepository");

const User = require("../models/User");

// User specific data access methods
class UserRepository extends BaseRepository {

    constructor() {
        super(User)
    }

    findByEmail(email) {
        return User.findOne({ email })
    }

    findByUsername(username) {
        return User.findOne({ username })
    }

    findByEmailOrUsername(email, username) {
        return User.findOne({
            $or: [{ email }, { username }],
        })
    }

    findByEmailWithPassword(email) {
        return User.findOne({ email }).select("+password")
    }

    findByIdWithPassword(id) {
        return User.findById(id).select("+password")
    }

    findByIdWithRefreshToken(id) {
        return User.findById(id).select("+refreshToken")
    }

    updateRefreshToken(id, token) {
        return User.findByIdAndUpdate(id, { refreshToken: token })
    }

    updateLastLogin(id) {
        return User.findByIdAndUpdate(id, { lastLoginAt: new Date() })
    }

    updateAvatar(id, url) {
        return User.findByIdAndUpdate(
            id,
            { profilePicture: url },
            { new: true }
        )
    }

    removeAvatar(id) {
        return User.findByIdAndUpdate(
            id,
            { profilePicture: "" },
            { new: true }
        )
    }

    // Record meeting join - creates or appends an active session for the participant
    async recordMeetingJoin(userId, meetingId) {
        try {
            const user = await User.findById(userId);
            if (!user) return null;

            if (!user.attendedMeetings) {
                user.attendedMeetings = [];
            }

            const meetingRecord = user.attendedMeetings.find(
                (a) => a.meeting && a.meeting.toString() === meetingId.toString()
            );

            const now = new Date();
            if (!meetingRecord) {
                user.attendedMeetings.push({
                    meeting: meetingId,
                    joinedAt: now,
                    leftAt: null,
                    totalDurationSeconds: 0,
                    sessions: [
                        {
                            joinedAt: now,
                            leftAt: null,
                            durationSeconds: 0,
                        },
                    ],
                });
            } else {
                if (!meetingRecord.sessions) {
                    meetingRecord.sessions = [];
                }
                const openSession = meetingRecord.sessions.find((s) => !s.leftAt);
                if (!openSession) {
                    meetingRecord.sessions.push({
                        joinedAt: now,
                        leftAt: null,
                        durationSeconds: 0,
                    });
                }
            }

            return await User.updateOne(
                { _id: userId },
                { $set: { attendedMeetings: user.attendedMeetings } }
            );
        } catch (err) {
            console.warn("recordMeetingJoin error:", err.message);
            return null;
        }
    }

    // Record meeting leave - closes active session and accumulates total duration seconds
    async recordMeetingLeave(userId, meetingId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.attendedMeetings) return null;

            const meetingRecord = user.attendedMeetings.find(
                (a) => a.meeting && a.meeting.toString() === meetingId.toString()
            );

            if (!meetingRecord) return null;

            const now = new Date();
            meetingRecord.leftAt = now;

            if (!meetingRecord.sessions || meetingRecord.sessions.length === 0) {
                const joinTime = meetingRecord.joinedAt || now;
                const durSec = Math.max(
                    1,
                    Math.round((now.getTime() - new Date(joinTime).getTime()) / 1000)
                );
                meetingRecord.sessions = [
                    {
                        joinedAt: joinTime,
                        leftAt: now,
                        durationSeconds: durSec,
                    },
                ];
                meetingRecord.totalDurationSeconds = durSec;
            } else {
                for (const session of meetingRecord.sessions) {
                    if (!session.leftAt) {
                        session.leftAt = now;
                        const durSec = Math.max(
                            1,
                            Math.round(
                                (now.getTime() - new Date(session.joinedAt).getTime()) / 1000
                            )
                        );
                        session.durationSeconds = durSec;
                    }
                }
                meetingRecord.totalDurationSeconds = meetingRecord.sessions.reduce(
                    (sum, s) => sum + (s.durationSeconds || 0),
                    0
                );
            }

            return await User.updateOne(
                { _id: userId },
                { $set: { attendedMeetings: user.attendedMeetings } }
            );
        } catch (err) {
            console.warn("recordMeetingLeave error:", err.message);
            return null;
        }
    }

    // Close any open sessions for all users who attended a meeting when the meeting finishes
    async closeMeetingSessions(meetingId, endedAt = new Date()) {
        try {
            const users = await User.find({
                "attendedMeetings.meeting": meetingId,
            });

            for (const user of users) {
                let changed = false;
                for (const record of user.attendedMeetings || []) {
                    if (record.meeting && record.meeting.toString() === meetingId.toString()) {
                        record.leftAt = endedAt;
                        if (record.sessions && record.sessions.length > 0) {
                            for (const session of record.sessions) {
                                if (!session.leftAt) {
                                    session.leftAt = endedAt;
                                    const durSec = Math.max(
                                        1,
                                        Math.round(
                                            (new Date(endedAt).getTime() -
                                                new Date(session.joinedAt).getTime()) /
                                                1000
                                        )
                                    );
                                    session.durationSeconds = durSec;
                                    changed = true;
                                }
                            }
                            record.totalDurationSeconds = record.sessions.reduce(
                                (sum, s) => sum + (s.durationSeconds || 0),
                                0
                            );
                        }
                    }
                }
                if (changed) {
                    await User.updateOne(
                        { _id: user._id },
                        { $set: { attendedMeetings: user.attendedMeetings } }
                    );
                }
            }
        } catch (err) {
            console.warn("closeMeetingSessions error:", err.message);
        }
    }

    // Backwards-compatible wrappers
    addAttendedMeeting(userId, meetingId) {
        return this.recordMeetingJoin(userId, meetingId);
    }

    updateAttendedMeeting(userId, meetingId) {
        return this.recordMeetingLeave(userId, meetingId);
    }

    // Add meeting to hiddenMeetings
    addHiddenMeeting(userId, meetingId) {
        return User.findByIdAndUpdate(
            userId,
            { $addToSet: { hiddenMeetings: meetingId } },
            { new: true }
        );
    }
}

module.exports = new UserRepository()