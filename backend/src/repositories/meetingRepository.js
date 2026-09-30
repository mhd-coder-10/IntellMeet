
// Handles all database queries for meetings
// Provides reusable methods like findByCode, findByUser, addParticipant

const BaseRepository = require("./baseRepository");
const Meeting = require("../models/Meeting");

class MeetingRepository extends BaseRepository {
    constructor() {
        super(Meeting)
    }

    findByCode(code) {
        return Meeting.findOne({ meetingCode: code.toUpperCase() })
    }

    findByHost(hostId) {
        return Meeting.find({ host: hostId }).sort({ createdAt: -1 })
    }

    findByParticipant(userId) {
        return Meeting.find({ participants: userId }).sort({ createdAt: -1 })
    }

    findByUser(userId) {
        return Meeting.find({
            $or: [{ host: userId }, { participants: userId }],
        })
            .populate("host", "name username profilePicture")
            .populate("participants", "name username profilePicture")
            .sort({ createdAt: -1 })
    }

    findByIdPopulated(id) {
        return Meeting.findById(id)
            .populate("host", "name username email profilePicture")
            .populate("participants", "name username email profilePicture")
    }

    addParticipant(meetingId, userId) {
        return Meeting.findByIdAndUpdate(
            meetingId,
            { $addToSet: { participants: userId } },
            { new: true }
        )
    }

    removeParticipant(meetingId, userId) {
        return Meeting.findByIdAndUpdate(
            meetingId,
            { $pull: { participants: userId } },
            { new: true }
        )
    }
}

module.exports = new MeetingRepository()