// Task Controller (Kanban Cards)
// Handles endpoints for Kanban tasks, column movements, real-time broadcasts, and comments

const taskService = require("../services/taskService");

const createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.params.projectId, req.user.id, req.body);

    const io = req.app.get("io");
    if (io) {
      io.to(`project:${task.project}`).emit("task:created", task);
    }

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create task",
    });
  }
};

const getTasksByProject = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByProject(req.params.projectId);
    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch tasks",
    });
  }
};

const moveTask = async (req, res) => {
  try {
    const task = await taskService.moveTask(req.params.id, req.user.id, req.body);

    const io = req.app.get("io");
    if (io) {
      io.to(`project:${task.project}`).emit("task:moved", {
        taskId: task._id,
        columnId: task.columnId,
        status: task.status,
        order: task.order,
        task,
      });
    }

    res.status(200).json({
      success: true,
      message: "Task moved successfully",
      data: task,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to move task",
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.user.id, req.body);

    const io = req.app.get("io");
    if (io) {
      io.to(`project:${task.project}`).emit("task:updated", task);
    }

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to update task",
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const result = await taskService.deleteTask(req.params.id, req.user.id);

    const io = req.app.get("io");
    if (io) {
      if (result.project) {
        io.to(`project:${result.project}`).emit("task:deleted", { taskId: req.params.id });
      }
      io.emit("task:deleted", { taskId: req.params.id });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: { taskId: req.params.id },
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to delete task",
    });
  }
};

const addComment = async (req, res) => {
  try {
    const task = await taskService.addComment(req.params.id, req.user.id, req.body.text);

    const io = req.app.get("io");
    if (io) {
      io.to(`project:${task.project}`).emit("task:updated", task);
    }

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: task,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to add comment",
    });
  }
};

module.exports = {
  createTask,
  getTasksByProject,
  moveTask,
  updateTask,
  deleteTask,
  addComment,
};
