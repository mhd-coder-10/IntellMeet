// Handles all database queries for notifications
// Provides methods for creating, fetching and marking as read

const BaseRepository = require("./baseRepository")
const Notification = require("../models/Notification")

class NotificationRepository extends BaseRepository {
    constructor() {
        super(Notification)
    }

    createNotification(data) {
        return Notification.create(data)
    }

    findByRecipient(userId, limit = 20) {
        return Notification.find({ recipient: userId })
            .populate("sender", "name username profilePicture")
            .sort({ createdAt: -1 })
            .limit(limit)
    }

    findUnreadCount(userId) {
        return Notification.countDocuments({ recipient: userId, isRead: false })
    }

    markAsRead(notificationId, userId) {
        return Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        )
    }

    markAllAsRead(userId) {
        return Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true, readAt: new Date() }
        )
    }

    deleteNotification(notificationId, userId) {
        return Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId,
        })
    }
}

module.exports = new NotificationRepository()