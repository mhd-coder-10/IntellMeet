// Handles HTTP requests for notification management
// Provides endpoints to fetch, read and delete notifications

const notificationService = require("../services/notificationService")

const getNotifications = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20
        const data = await notificationService.getUserNotifications(req.user.id, limit);
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

const markAsRead = async (req, res) => {
    try {
        const data = await notificationService.markAsRead(req.params.id,req.user.id);
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

const markAllAsRead = async (req, res) => {
    try {
        const data = await notificationService.markAllAsRead(req.user.id)
        res.status(200).json({ success: true, ...data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

const deleteNotification = async (req, res) => {
    try {
        const data = await notificationService.deleteNotification(req.params.id, req.user.id);
        res.status(200).json({ success: true, ...data })
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        })
    }
}

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
}   