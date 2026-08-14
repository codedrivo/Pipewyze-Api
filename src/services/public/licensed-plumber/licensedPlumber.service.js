const User = require('../../../models/user.model');
const LicensedPlumberProfile = require('../../../models/licensedPlumberProfile.model');
const ApiError = require('../../../helpers/apiErrorConverter');

const createLicensedPlumber = async (data) => {
  if (await User.findOne({ email: data.email })) {
    throw new ApiError('Email already taken', 400);
  }
  if (data.phone && (await User.findOne({ phone: data.phone }))) {
    throw new ApiError('Phone number already registered', 400);
  }
  const { yearsOfService, serviceLocations, servicesOffered, latitude, longitude, ...userData } =
    data;

  const user = await User.create({ ...userData, role: 'licensed-plumber' });

  const profileData = {
    userId: user._id,
    yearsOfService: yearsOfService || '',
    serviceLocations: serviceLocations || [],
    servicesOffered: servicesOffered || [],
  };

  if (latitude !== undefined && longitude !== undefined && latitude !== '' && longitude !== '' && latitude !== null && longitude !== null) {
    profileData.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0],
    };
  }

  const profile = await LicensedPlumberProfile.create(profileData);

  return {
    ...user.toJSON(),
    yearsOfService: profile.yearsOfService,
    serviceLocations: profile.serviceLocations,
    servicesOffered: profile.servicesOffered,
    location: profile.location,
  };
};

const getLicensedPlumberById = async (id) => {
  const user = await User.findOne({ _id: id, role: 'licensed-plumber' });
  if (!user) {
    throw new ApiError('Licensed Plumber not found', 404);
  }

  let profile = await LicensedPlumberProfile.findOne({ userId: id });
  if (!profile) {
    profile = { yearsOfService: '', serviceLocations: [], servicesOffered: [] };
  }

  return {
    ...user.toJSON(),
    yearsOfService: profile.yearsOfService,
    serviceLocations: profile.serviceLocations,
    servicesOffered: profile.servicesOffered,
  };
};

const updateLicensedPlumberById = async (id, updateBody) => {
  const user = await User.findOne({ _id: id, role: 'licensed-plumber' });
  if (!user) {
    throw new ApiError('Licensed Plumber not found', 404);
  }
  if (
    updateBody.email &&
    (await User.findOne({ email: updateBody.email, _id: { $ne: id } }))
  ) {
    throw new ApiError('Email already taken', 400);
  }
  if (
    updateBody.phone &&
    (await User.findOne({ phone: updateBody.phone, _id: { $ne: id } }))
  ) {
    throw new ApiError('Phone number already registered', 400);
  }

  const { yearsOfService, serviceLocations, servicesOffered, latitude, longitude, ...userData } =
    updateBody;

  Object.assign(user, userData);
  await user.save();

  let profile = await LicensedPlumberProfile.findOne({ userId: id });
  if (!profile) {
    profile = new LicensedPlumberProfile({ userId: id });
  }

  if (yearsOfService !== undefined) profile.yearsOfService = yearsOfService;
  if (serviceLocations !== undefined)
    profile.serviceLocations = serviceLocations;
  if (servicesOffered !== undefined) profile.servicesOffered = servicesOffered;

  if (latitude !== undefined && longitude !== undefined) {
    if (latitude === '' || longitude === '' || latitude === null || longitude === null) {
      profile.location = undefined;
    } else {
      profile.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0],
      };
    }
  }

  await profile.save();

  return {
    ...user.toJSON(),
    yearsOfService: profile.yearsOfService,
    serviceLocations: profile.serviceLocations,
    servicesOffered: profile.servicesOffered,
  };
};

const deleteLicensedPlumberById = async (id) => {
  const user = await User.findOne({ _id: id, role: 'licensed-plumber' });
  if (!user) {
    throw new ApiError('Licensed Plumber not found', 404);
  }
  await User.deleteOne({ _id: id });
  await LicensedPlumberProfile.deleteOne({ userId: id });
  return user;
};

const queryLicensedPlumbers = async (
  searchQuery = '',
  page = 1,
  limit = 10,
  latitude = null,
  longitude = null,
  radius = 2, // default 2
  unit = 'km', // default unit is km
) => {
  const query = { role: 'licensed-plumber' };

  if (latitude !== null && longitude !== null && latitude !== '' && longitude !== '') {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const multiplier = unit === 'miles' ? 1609.34 : 1000;
    const radMeters = parseFloat(radius || 2) * multiplier;

    const nearbyProfiles = await LicensedPlumberProfile.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: radMeters,
        },
      },
    }).select('userId');

    const nearbyUserIds = nearbyProfiles.map((p) => p.userId);
    query._id = { $in: nearbyUserIds };
  }

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

  const results = await Promise.all(
    users.map(async (user) => {
      const profile = await LicensedPlumberProfile.findOne({
        userId: user._id,
      });
      return {
        ...user.toJSON(),
        yearsOfService: profile ? profile.yearsOfService : '',
        serviceLocations: profile ? profile.serviceLocations : [],
        servicesOffered: profile ? profile.servicesOffered : [],
        location: profile ? profile.location : null,
      };
    }),
  );

  return {
    results,
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
