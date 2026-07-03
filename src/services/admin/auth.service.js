const User = require('../../models/user.model');
const ApiError = require('../../helpers/apiErrorConverter');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const loginUser = async (emailOrUsername, password) => {
  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });
    if (!user) {
      throw new ApiError('User not found', 404);
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new ApiError('Incorrect password', 401);
    }
    return user;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const findUserByEmail = async (email) => {
  return User.findOne({ email });
};

const changePassword = async (email, password) => {
  const pwd = await bcrypt.hash(password, 8);
  return User.findOneAndUpdate({ email }, { password: pwd });
};

const getUserById = async (id) => {
  return User.findById(new mongoose.Types.ObjectId(id));
};

const updateAdminImage = async (id, profileimageurl) => {
  return await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { profileimageurl } },
    {
      returnDocument: 'after',
    },
  );
};

const updateUser = async (id, data) => {
  console.log(data);
  return await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: data },
    {
      returnDocument: 'after',
    },
  );
};

module.exports = {
  loginUser,
  findUserByEmail,
  changePassword,
  getUserById,
  updateAdminImage,
  updateUser,
};
