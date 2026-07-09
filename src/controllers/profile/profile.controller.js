const catchAsync = require('../../helpers/asyncErrorHandler');

const ApiError = require('../../helpers/apiErrorConverter');

// Delete account
const deleteAccount = catchAsync(async (req, res, next) => {
  await service.deleteAccountById(req.user._id);
  res.status(200).send({ message: 'Account Deleted Successfully' });
});

const edituser = catchAsync(async (req, res) => {
  const userData = await service.getUserByIdWithGroup(req.params.id);
  const teamData = await service.getTeamByUserId(req.params.id);
  const matchData = await service.getMatchByUserId(req.params.id, teamData);
  res.status(200).send({
    status: 200,
    userData: userData,
    team: teamData,
    matchData: matchData,
  });
});

// Password change
const passwordChange = catchAsync(async (req, res, next) => {
  await service.updatePassword(
    req.user,
    req.body.password_new,
    req.body.password_old,
  );
  res
    .status(200)
    .send({ status: 200, message: 'Password Updated Successfully' });
});

// Notification settings
const notificationToggle = catchAsync(async (req, res, next) => {
  await service.updateNotificationSetting(
    req.user.email,
    req.body.notification,
  );
  res
    .status(200)
    .send({ message: 'Notification Settings Updated Successfully' });
});

// Get profile
const getProfile = catchAsync(async (req, res, next) => {
  const userData = req.user.toJSON ? req.user.toJSON() : { ...req.user };
  delete userData.password;

  res.status(200).send({
    message: 'Profile retrieved successfully',
    data: {
      user: userData,
    },
  });
});

// Helper function to deeply parse JSON strings
const deepParseJSON = (data) => {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return deepParseJSON(parsed);
    } catch {
      return data;
    }
  }

  if (Array.isArray(data)) {
    return data.map((item) => deepParseJSON(item));
  }

  if (data && typeof data === 'object') {
    const result = {};
    for (const key in data) {
      result[key] = deepParseJSON(data[key]);
    }
    return result;
  }

  return data;
};

const updateProfile = catchAsync(async (req, res) => {
  const { fullName, phone } = req.body;

  const updateData = {
    ...(fullName && { fullName }),
  };

  if (phone && phone !== req.user.phone) {
    const existingUser = await service.findUserByPhone(phone);

    if (existingUser && !existingUser._id.equals(req.user._id)) {
      throw new ApiError(
        'This phone number is already registered to another account.',
        400,
      );
    }

    updateData.phone = phone;
  }

  if (req.file) {
    updateData.profileimageurl = req.file.location || req.file.path;
  }

  const user = await service.updateUser(req.user._id, updateData);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

const listusers = catchAsync(async (req, res, next) => {
  const id = req.user._id;
  const users = await service.listUser(id);
  res.status(200).send({ users });
});

const addSupport = catchAsync(async (req, res) => {
  const user = req.user;
  const data = {
    userId: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    ...req.body,
  };
  const supportData = await service.addSupport(data);
  res.status(200).json({
    message: 'Data added successfully',
    data: supportData,
  });
});

module.exports = {
  deleteAccount,
  passwordChange,
  getProfile,
  updateProfile,
  notificationToggle,
  addSupport,
  listusers,
  edituser,
};
