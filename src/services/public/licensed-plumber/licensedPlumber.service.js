const User = require('../../../models/user.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const createLicensedPlumber = async (data) => {
  if (await User.findOne({ email: data.email })) {
    throw new ApiError('Email already taken', 400);
  }
  const licensedPlumber = await User.create({ ...data, role: 'licensed-plumber' });
  return licensedPlumber;
};

const getLicensedPlumberById = async (id) => {
  const licensedPlumber = await User.findOne({ _id: id, role: 'licensed-plumber' });
  if (!licensedPlumber) {
    throw new ApiError('Licensed Plumber not found', 404);
  }
  return licensedPlumber;
};

const updateLicensedPlumberById = async (id, updateBody) => {
  const licensedPlumber = await getLicensedPlumberById(id);
  if (updateBody.email && (await User.findOne({ email: updateBody.email, _id: { $ne: id } }))) {
    throw new ApiError('Email already taken', 400);
  }
  Object.assign(licensedPlumber, updateBody);
  await licensedPlumber.save();
  return licensedPlumber;
};

const deleteLicensedPlumberById = async (id) => {
  const licensedPlumber = await getLicensedPlumberById(id);
  await User.deleteOne({ _id: id });
  return licensedPlumber;
};

const queryLicensedPlumbers = async (searchQuery = '', page = 1, limit = 10) => {
  const query = { role: 'licensed-plumber' };
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
  createLicensedPlumber,
  getLicensedPlumberById,
  updateLicensedPlumberById,
  deleteLicensedPlumberById,
  queryLicensedPlumbers,
};
