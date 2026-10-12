// Team & Project Kanban Socket Handlers
// Enables real-time card movement, creation, and updates on collaborative Kanban boards

const registerTeamHandlers = (io, socket) => {
  // Join team workspace room
  socket.on("team:join", ({ teamId }) => {
    if (teamId) {
      socket.join(`team:${teamId}`);
    }
  });

  // Leave team workspace room
  socket.on("team:leave", ({ teamId }) => {
    if (teamId) {
      socket.leave(`team:${teamId}`);
    }
  });

  // Join project board room
  socket.on("project:join", ({ projectId }) => {
    if (projectId) {
      socket.join(`project:${projectId}`);
    }
  });

  // Leave project board room
  socket.on("project:leave", ({ projectId }) => {
    if (projectId) {
      socket.leave(`project:${projectId}`);
    }
  });

  // Real-time broadcast for moving task between columns
  socket.on("task:move", ({ projectId, taskId, columnId, order }) => {
    if (projectId && taskId) {
      socket.to(`project:${projectId}`).emit("task:moved", {
        taskId,
        columnId,
        order,
      });
    }
  });
};

module.exports = { registerTeamHandlers };
