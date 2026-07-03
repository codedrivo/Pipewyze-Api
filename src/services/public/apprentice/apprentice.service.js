const User = require('../../../models/user.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const createApprentice = async (data) => {
  if (await User.findOne({ email: data.email })) {
    throw new ApiError('Email already taken', 400);
  }
  const apprentice = await User.create({ ...data, role: 'apprentice' });
  return apprentice;
};

const getApprenticeById = async (id) => {
  const apprentice = await User.findOne({ _id: id, role: 'apprentice' });
  if (!apprentice) {
    throw new ApiError('Apprentice not found', 404);
  }
  return apprentice;
};

const updateApprenticeById = async (id, updateBody) => {
  const apprentice = await getApprenticeById(id);
  if (updateBody.email && (await User.findOne({ email: updateBody.email, _id: { $ne: id } }))) {
    throw new ApiError('Email already taken', 400);
  }
  Object.assign(apprentice, updateBody);
  await apprentice.save();
  return apprentice;
};

const deleteApprenticeById = async (id) => {
  const apprentice = await getApprenticeById(id);
  await User.deleteOne({ _id: id });
  return apprentice;
};

const queryApprentices = async (searchQuery = '', page = 1, limit = 10) => {
  const query = { role: 'apprentice' };
  if (searchQuery) {
    const sanitizedSearch = searchQuery.replace(/"/g, '');
    query.$or = [
      { fullName: { $regex: sanitizedSearch, $options: 'i' } },
      { email: { $regex: sanitizedSearch, $options: 'i' } },
    ];
  }
  const skip = (page - 1) * limit;
  const totalResults = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    results: users,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

module.exports = {
  createApprentice,
  getApprenticeById,
  updateApprenticeById,
  deleteApprenticeById,
  queryApprentices,
};
