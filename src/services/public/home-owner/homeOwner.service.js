const User = require('../../../models/user.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const createHomeOwner = async (data) => {
  if (await User.findOne({ email: data.email })) {
    throw new ApiError('Email already taken', 400);
  }
  const homeOwner = await User.create({ ...data, role: 'home-owner' });
  return homeOwner;
};

const getHomeOwnerById = async (id) => {
  const homeOwner = await User.findOne({ _id: id, role: 'home-owner' });
  if (!homeOwner) {
    throw new ApiError('Home Owner not found', 404);
  }
  return homeOwner;
};

const updateHomeOwnerById = async (id, updateBody) => {
  const homeOwner = await getHomeOwnerById(id);
  if (updateBody.email && (await User.findOne({ email: updateBody.email, _id: { $ne: id } }))) {
    throw new ApiError('Email already taken', 400);
  }
  Object.assign(homeOwner, updateBody);
  await homeOwner.save();
  return homeOwner;
};

const deleteHomeOwnerById = async (id) => {
  const homeOwner = await getHomeOwnerById(id);
  await User.deleteOne({ _id: id });
  return homeOwner;
};

const queryHomeOwners = async (searchQuery = '', page = 1, limit = 10) => {
  const query = { role: 'home-owner' };
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
  createHomeOwner,
  getHomeOwnerById,
  updateHomeOwnerById,
  deleteHomeOwnerById,
  queryHomeOwners,
};
