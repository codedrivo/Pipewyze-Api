const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/auth.service');
const { updatePassword } = require('../../services/auth/auth.service');

const updateProfileImage = catchAsync(async (req, res, next) => {
  let profileimageurl;
  if (req.file) {
    profileimageurl = req.file.location;
  }
  const user = await service.updateAdminImage(req.user._id, profileimageurl);
  res
    .status(200)
    .send({ message: 'Profile image updated successfully', userData: user });
});

const updateProfile = catchAsync(async (req, res, next) => {
  try {
    const user = await service.updateUser(req.user._id, req.body);
    res
      .status(200)
      .send({ message: 'Profile updated successfully', userData: user });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res
      .status(500)
      .send({ message: 'Something went wrong', error: error.message });
  }
});

// Password change
const passwordChange = catchAsync(async (req, res, next) => {
  await updatePassword(req.user, req.body.password_new, req.body.password_old);
  res.status(200).send({ message: 'Password Updated Successfully' });
});

module.exports = {
  updateProfileImage,
  updateProfile,
  passwordChange,
};
