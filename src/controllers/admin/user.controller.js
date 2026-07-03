const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/user.service');
const listUser = catchAsync(async (req, res, next) => {
  const limit = req.params.limit ? Number(req.params.limit) : 10;
  const page = req.params.page ? Number(req.params.page) : 1;
  const search = req.body.search ? req.body.search : '';
  const role = req.body.role ? req.body.role : '';
  const users = await service.userListFind(
    req.user._id,
    limit,
    page,
    search,
    role,
  );
  res.status(200).send({ status: 200, users });
});

const addUser = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.profileimageurl = req.file.location;
  }
  const userData = await service.addUser(data);
  res.status(200).json({
    status: 200,
    message: 'User added successfully',
    userdata: userData,
  });
});

const edituser = catchAsync(async (req, res) => {
  const userData = await service.editUser(req.params.id);
  res.status(200).send({ status: 200, userData: userData });
});

const updateUser = catchAsync(async (req, res) => {
  const id = req.params.id;
  const data = { ...req.body };
  if (req.file && req.file.location) {
    data.profileimageurl = req.file.location;
  }
  const updateData = await service.updateUser(id, data);
  res.status(200).json({
    status: 200,
    message: 'User updated successfully',
    userData: updateData,
  });
});

const deleteUser = catchAsync(async (req, res) => {
  await service.deleteUser(req.params.id);
  res.status(200).send({ status: 200, message: 'User deleted successfully' });
});

const userVerification = catchAsync(async (req, res) => {
  const verificationStatus = await service.userVerification(
    req.params.id,
    req.body.isVerfied,
  );
  res.status(200).json({ message: 'Status updated', verificationStatus });
});

// Block unblock user
const userBlockUnblock = catchAsync(async (req, res) => {
  const userStatus = await service.userBlockUnblock(
    req.params.id,
    req.body.isActive,
  );
  res.status(200).json({ message: 'Status updated', userStatus });
});

const getInvitations = catchAsync(async (req, res) => {
  const limit = req.params.limit ? Number(req.params.limit) : 10;
  const page = req.params.page ? Number(req.params.page) : 1;
  const search = req.body.search ? req.body.search : '';
  const invitations = await service.userInvitations(
    req.params.id,
    limit,
    page,
    search,
  );
  res.status(200).json({ status: 200, invitations });
});

module.exports = {
  listUser,
  addUser,
  edituser,
  updateUser,
  deleteUser,
  userVerification,
  userBlockUnblock,
  getInvitations,
};
