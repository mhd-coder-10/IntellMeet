// Contains notification business logic for creation and management
// Provides helper to send real-time notifications via Socket.io

const notificationRepo = require("../repositories/notificationRepository");

const createNotification = async (data) => {
    const notification = await notificationRepo.createNotification(data);
    const populated = await notificationRepo.findById(notification._id);
    await populated.populate("sender", "name username profilePicture");
    return { notification: populated }
}

const getUserNotifications = async (userId, limit = 20) => {
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
    const notification = await notificationRepo.deleteNotification(notificationId,userId);
    if (!notification) {
        const error = new Error("Notification not found")
        error.statusCode = 404
        throw error
    }
    return { message: "Notification deleted" }
}

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
}