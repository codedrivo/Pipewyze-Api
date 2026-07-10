const User = require('../../models/user.model');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const ApiError = require('../../helpers/apiErrorConverter');

// Create new user
const createUser = async (data) => {
  // Check for existing email
  const existingUser = await User.findOne({
    $or: [
      { email: data.email },
      ...(data.phone ? [{ phone: data.phone }] : []),
    ],
  });

  if (existingUser) {
    if (existingUser.email === data.email) {
      throw new ApiError('Email already exists', 400);
    }
    if (data.phone && existingUser.phone === data.phone) {
      throw new ApiError('Phone number already exists', 400);
    }
  }

  if (!data.fullName && data.firstName) {
    data.fullName = `${data.firstName} ${data.lastName || ''}`.trim();
  }

  // Create user
  const user = await User.create(data);
  return getUserById(user._id);
};

// User login
const loginUser = async (email, password, role) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  if (role && user.role !== role) {
    throw new ApiError('Invalid credentials or role mismatch', 403);
  }

  if (!['home-owner', 'apprentice', 'licensed-plumber'].includes(user.role)) {
    throw new ApiError('This credential does not belong to a mobile user', 403);
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError('Invalid email or password', 401);
  }
  user.online = true;
  await user.save();
  return getUserById(user._id);
};

// Find user by id
const findUserByEmail = async (email) => {
  return User.findOne({ email });
};

// Find user by id
const findUserByPhone = async (phone) => {
  return User.findOne({ phone });
};

// Find user by id
const checkUserExistById = async (id) => {
  return User.findById(id);
};
// Change pasword
const changePassword = async (email, password) => {
  const pwd = await bcrypt.hash(password, 8);
  return User.findOneAndUpdate({ email }, { password: pwd });
};

// Update notification settings
const updateNotificationSetting = async (email, notification) => {
  return User.findOneAndUpdate({ email }, { notification });
};

const getUserById = async (id) => {
  return User.findById(new mongoose.Types.ObjectId(id));
};

const getUserDataById = async (id) => {
  try {
    return User.findById(new mongoose.Types.ObjectId(id));
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

// Delete user account
const deleteAccountById = async (id) => {
  return User.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
};

// Update password
const updatePassword = async (user, newpass, oldpass) => {
  const isMatch = await bcrypt.compare(oldpass, user.password);
  if (!isMatch) {
    throw new ApiError('Password does not match', 400);
  }
  if (oldpass.trim() === newpass.trim()) {
    throw new ApiError(
      'New password cannot be the same as the old password',
      400,
    );
  }
  return changePassword(user.email, newpass);
};

// Update User
const updateUser = async (id, data) => {
  // Get existing user to preserve data that might not be in the update
  const existingUser = await User.findById(id);

  if (!existingUser) {
    throw new Error('User not found');
  }

  // Handle siblings array if provided
  if (data.siblings) {
    data.siblingsCount = data.siblings.length;
  }

  // Handle sameAsEarly logic
  if (data.sameAsEarly === true && data.earlyChildhood) {
    data.lateChildhood = data.earlyChildhood;
  }

  // Handle sameAsEarlyAdulthood logic
  if (data.sameAsEarlyAdulthood === true && data.earlyAdulthood) {
    data.lateAdulthood = data.earlyAdulthood;
  }

  // Handle referenceImages to prevent data loss
  if (data.referenceImages) {
    const existingReferenceImages = existingUser.referenceImages || {};

    data.referenceImages = {
      earlyChildhood:
        data.referenceImages.earlyChildhood !== undefined
          ? data.referenceImages.earlyChildhood
          : existingReferenceImages.earlyChildhood,
      lateChildhood:
        data.referenceImages.lateChildhood !== undefined
          ? data.referenceImages.lateChildhood
          : existingReferenceImages.lateChildhood,
      earlyAdulthood:
        data.referenceImages.earlyAdulthood !== undefined
          ? data.referenceImages.earlyAdulthood
          : existingReferenceImages.earlyAdulthood,
      lateAdulthood:
        data.referenceImages.lateAdulthood !== undefined
          ? data.referenceImages.lateAdulthood
          : existingReferenceImages.lateAdulthood,
    };
  } else {
    delete data.referenceImages;
  }

  // Handle ethnicityOther fields
  if (data.ethnicity !== 'Other') {
    data.ethnicityOther = '';
  }
  if (data.paternalEthnicity !== 'Other') {
    data.paternalEthnicityOther = '';
  }
  if (data.maternalEthnicity !== 'Other') {
    data.maternalEthnicityOther = '';
  }

  // FIXED: Ensure musicGenres is a clean array
  if (data.musicGenres) {
    // If it's a string, try to parse it
    if (typeof data.musicGenres === 'string') {
      try {
        data.musicGenres = JSON.parse(data.musicGenres);
      } catch {
        data.musicGenres = [data.musicGenres];
      }
    }

    // Ensure it's an array and filter out empty strings
    if (!Array.isArray(data.musicGenres)) {
      data.musicGenres = [data.musicGenres];
    }
    data.musicGenres = data.musicGenres.filter(
      (genre) => genre && genre.trim() !== '',
    );
  }

  // Ensure isProfileCompleted is set to true
  data.isProfileCompleted = true;

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  );

  // Sync basic info with Contractor model if the user is a contractor
  if (
    updatedUser &&
    updatedUser.role === 'contractor' &&
    (data.firstName || data.lastName || data.email || data.phone)
  ) {
    const contractorUpdate = {};
    if (data.firstName) contractorUpdate.firstName = data.firstName;
    if (data.lastName) contractorUpdate.lastName = data.lastName;
    if (data.email) contractorUpdate.email = data.email;
    if (data.phone) contractorUpdate.phone = data.phone;

    await Contractor.findOneAndUpdate(
      { userId: id },
      { $set: contractorUpdate },
    );
  }

  return updatedUser;
};

// Check if profile is complete (optional utility)
const isProfileComplete = async (id) => {
  const user = await User.findById(id);

  const requiredFields = [
    'firstName',
    'lastName',
    'email',
    'gender',
    'ageGroup',
  ];

  const isComplete = requiredFields.every(
    (field) => user[field] && user[field].toString().trim() !== '',
  );

  return isComplete;
};

const listUser = async (currentUserId) => {
  const totalItems = await User.countDocuments({
    role: 'user',
    _id: { $ne: currentUserId },
  });
  const users = await User.find({ role: 'user', _id: { $ne: currentUserId } })
    .sort({ createdAt: -1 })
    .limit(30);

  const userList = {
    users,
    totalResults: totalItems,
  };

  return userList;
};

const addSupport = async (data) => {
  return Support.create(data);
};

module.exports = {
  createUser,
  loginUser,
  findUserByEmail,
  changePassword,
  getUserById,
  deleteAccountById,
  updatePassword,
  updateNotificationSetting,
  getUserDataById,
  checkUserExistById,
  updateUser,
  isProfileComplete,
  listUser,
  findUserByPhone,
  addSupport,
};
