const ApiError = require('../helpers/apiErrorConverter');

const addSession = async (userId, socket) => {
  try {
    await deleteSessionByUserId(userId);
    return UserSession.create({ userId, socket });
  } catch (e) {
    console.log(e.message);
  }
};

const deleteSession = async (socket) => {
  try {
    const result = await UserSession.deleteOne({ socket });
    return result;
  } catch (e) {
    console.log(e.message);
  }
};

const deleteSessionByUserId = async (userId) => {
  try {
    const result = await UserSession.deleteOne({ userId });
    return result;
  } catch (e) {
    console.log(e.message);
  }
};

const getSessionBySocket = async (socket) => {
  try {
    // Find the session first
    const session = await UserSession.findOne({ socket });
    return session;
  } catch (e) {
    console.log(e.message);
  }
};

const getSessionByUserID = async (userId) => {
  try {
    // Find the session first
    const session = await UserSession.findOne({ userId });
    return session;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  addSession,
  deleteSession,
  getSessionBySocket,
  getSessionByUserID,
};
