const User = require('../../models/user.model');
const ApiError = require('../../helpers/apiErrorConverter');

const mongoose = require('mongoose');
const { http } = require('winston');

const userListFind = async (
  id,
  limit = 10,
  page = 1,
  searchQuery = '',
  role = '',
) => {
  try {
    const query = {};
    if (searchQuery) {
      const sanitizedSearchTerm = searchQuery.replace(/"/g, '');
      query.$or = [
        { fullName: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { email: { $regex: sanitizedSearchTerm, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    } else {
      query.role = { $ne: 'admin' };
    }

    /* if (id) {
       query._id = { $ne: id };
     }*/

    const skip = (page - 1) * limit;
    const totalItems = await User.find(query).countDocuments();
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const userList = {
      users,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
      totalResults: totalItems,
    };

    return userList;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const addUser = async (userData) => {
  const user = await User.create(userData);
  return user;
};

const getUserById = (id) => {
  return User.findById(id);
};

const editUser = async (id) => {
  try {
    const user = await getUserById(id);

    return user;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const updateUser = async (id, data) => {
  return User.findByIdAndUpdate({ _id: new mongoose.Types.ObjectId(id) }, data);
};

const deleteUser = async (id) => {
  try {
    await User.findByIdAndDelete(id);
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const userVerification = async (id, status) => {
  const userData = await User.findByIdAndUpdate(
    id,
    {
      $set: { isVerfied: status },
    },
    { new: true },
  );
  return userData;
};

const userBlockUnblock = async (id, status) => {
  const userData = await User.findByIdAndUpdate(
    id,
    {
      $set: { isActive: status },
    },
    { new: true },
  );
  return userData;
};

const getUsersCount = async () => {
  const totalUsers = await User.countDocuments({
    role: { $ne: 'admin' },
  });
  return totalUsers;
};

const userInvitations = async (id, limit = 10, page = 1, searchQuery = '') => {
  try {
    const query = {};
    if (searchQuery) {
      const sanitizedSearchTerm = searchQuery.replace(/"/g, '');
      query.$or = [
        { description: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { transportationMoney: { $regex: sanitizedSearchTerm, $options: 'i' } },
      ];
    }

    if (id) {
      query.userId = id;
    }

    const skip = (page - 1) * limit;
    const totalItems = await Invitations.find(query).countDocuments();

    const invitations = await Invitations.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const invitationList = {
      invitations,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
      totalResults: totalItems,
    };

    return invitationList;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

module.exports = {
  userListFind,
  addUser,
  editUser,
  updateUser,
  deleteUser,
  userVerification,
  userBlockUnblock,
  getUsersCount,
  userInvitations,
};
