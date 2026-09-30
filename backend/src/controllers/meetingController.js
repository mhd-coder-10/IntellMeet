
// Handles HTTP requests and responses for meeting endpoints
// Calls meetingService for logic and sends back JSON response

const meetingService = require("../services/meetingService")

// Create new meeting
const createMeeting = async (req, res) => {
    try {
        const data = await meetingService.createMeeting(req.user.id, req.body)
        res.status(201).json({
            success: true,
            message: "Meeting created successfully",
            data,
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get meeting by ID
const getMeetingById = async (req, res) => {
    try {
        const data = await meetingService.getMeetingById(req.params.id)
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get meeting by code
const getMeetingByCode = async (req, res) => {
    try {
        const data = await meetingService.getMeetingByCode(req.params.code)
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Get all meetings of current user
const getUserMeetings = async (req, res) => {
    try {
        const data = await meetingService.getUserMeetings(req.user.id)
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Update meeting
const updateMeeting = async (req, res) => {
    try {
        const data = await meetingService.updateMeeting(
            req.params.id,
            req.user.id,
            req.body
        )
        res.status(200).json({
            success: true,
            message: "Meeting updated successfully",
            data,
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Delete meeting
const deleteMeeting = async (req, res) => {
    try {
        const data = await meetingService.deleteMeeting(
            req.params.id,
            req.user.id
        )
        res.status(200).json({ success: true, ...data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Join meeting
const joinMeeting = async (req, res) => {
    try {
        const data = await meetingService.joinMeeting(
            req.params.id,
            req.user.id
        )

        const io = req.app.get("io")
        if (io && data.userJoined) {
            const roomManager = require("../webrtc/roomManager")
            const users = roomManager.getRoomUsers(req.params.id)

            io.to(req.params.id).emit("meeting:user-joined", {
                userId: data.userJoined.userId,
                username: data.userJoined.username,
                name: data.userJoined.name,
                profilePicture: data.userJoined.profilePicture,
                totalUsers: users.length,
                source: "http",
            })
        }

        res.status(200).json({
            success: true,
            message: "Joined meeting successfully",
            data: { meeting: data.meeting },
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Leave meeting
const leaveMeeting = async (req, res) => {
    try {
        const data = await meetingService.leaveMeeting(
            req.params.id,
            req.user.id
        )

        const io = req.app.get("io")
        if (io && data.userLeft) {
            io.to(req.params.id).emit("meeting:user-left", {
                userId: data.userLeft.userId,
                name: data.userLeft.name,
                username: data.userLeft.username,
            })
        }

        res.status(200).json({
            success: true,
            message: data.message,
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// Start meeting
const startMeeting = async (req, res) => {
    try {
        const data = await meetingService.startMeeting(
            req.params.id,
            req.user.id
        )
        res.status(200).json({
            success: true,
            message: "Meeting started",
            data,
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

// End meeting
const endMeeting = async (req, res) => {
    try {
        const data = await meetingService.endMeeting(
            req.params.id,
            req.user.id
        )

        const io = req.app.get("io");
        if (io) {
            io.to(req.params.id).emit("meeting:ended", {
                meetingId: req.params.id,
                message: "Meeting has been ended by the host",
            })

            io.in(req.params.id).socketsLeave(req.params.id)
        }

        res.status(200).json({
            success: true,
            message: "Meeting ended",
            data,
        })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

module.exports = {
    createMeeting,
    getMeetingById,
    getMeetingByCode,
    getUserMeetings,
    updateMeeting,
    deleteMeeting,
    joinMeeting,
    leaveMeeting,
    startMeeting,
    endMeeting,
}