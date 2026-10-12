// Contains notification business logic for creation and management
// Provides helper to send real-time notifications via Socket.io

const notificationRepo = require("../repositories/notificationRepository");
const { getIO } = require("../socket/index");

const createNotification = async (data) => {
    const notification = await notificationRepo.createNotification(data);
    const populated = await notificationRepo.findById(notification._id);
    await populated.populate("sender", "name username profilePicture");

    // Real-time socket delivery to recipient
    try {
        const io = getIO();
        if (io && populated.recipient) {
            const recipientId = populated.recipient._id ? populated.recipient._id.toString() : populated.recipient.toString();
            io.to(`user:${recipientId}`).emit("notification:new", populated);
        }
    } catch (ioErr) {
        console.warn("Socket notification emit error:", ioErr.message);
    }

    return { notification: populated }
}

const getUserNotifications = async (userId, limit = 40) => {
    const notifications = await notificationRepo.findByRecipient(userId, limit);
    const unreadCount = await notificationRepo.findUnreadCount(userId);
    return { notifications, unreadCount }
}

const markAsRead = async (notificationId, userId) => {
    const notification = await notificationRepo.markAsRead(notificationId, userId);
    if (!notification) {
        const error = new Error("Notification not found")
        error.statusCode = 404
        throw error
    }
    return { notification }
}

const markAllAsRead = async (userId) => {
    await notificationRepo.markAllAsRead(userId);
    return { message: "All notifications marked as read" }
}

const deleteNotification = async (notificationId, userId) => {
    const notification = await notificationRepo.deleteNotification(notificationId, userId);
    if (!notification) {
        const error = new Error("Notification not found")
        error.statusCode = 404
        throw error
    }
    return { message: "Notification deleted" }
}

const clearAllNotifications = async (userId) => {
    await notificationRepo.deleteAll(userId);
    return { message: "All notifications cleared" }
}

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
}