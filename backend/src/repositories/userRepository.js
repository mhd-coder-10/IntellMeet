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
}

module.exports = new UserRepository()