// Generic CRUD operations for all repositories
class BaseRepository {

    constructor(model) {
        this.model = model
    }

    create(data) {
        return this.model.create(data)
    }

    findById(id, select = "") {
        return this.model.findById(id).select(select)
    }

    findOne(filter, select = "") {
        return this.model.findOne(filter).select(select)
    }

    findMany(filter = {}, select = "") {
        return this.model.find(filter).select(select)
    }

    updateById(id, data, options = {}) {
        return this.model.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
            ...options,
        })
    }

    deleteById(id) {
        return this.model.findByIdAndDelete(id)
    }

    count(filter = {}) {
        return this.model.countDocuments(filter)
    }
}

module.exports = BaseRepository