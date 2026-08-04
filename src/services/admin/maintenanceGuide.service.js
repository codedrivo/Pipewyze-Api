const MaintenanceGuide = require('../../models/maintenanceGuide.model');
const ApiError = require('../../helpers/apiErrorConverter');

const parseGuideFields = (data) => {
  if (typeof data.checklist === 'string') {
    try {
      data.checklist = JSON.parse(data.checklist);
    } catch (e) {
      data.checklist = [];
    }
  }

  const arrayFields = ['requiredTools', 'relatedCodes'];
  arrayFields.forEach((field) => {
    if (typeof data[field] === 'string') {
      try {
        data[field] = JSON.parse(data[field]);
      } catch (e) {
        if (data[field].trim() === '') {
          data[field] = [];
        } else {
          data[field] = data[field].split(',').map((id) => id.trim()).filter(Boolean);
        }
      }
    }
  });
};

const createMaintenanceGuide = async (data) => {
  parseGuideFields(data);
  const guide = await MaintenanceGuide.create(data);
  return guide;
};

const getMaintenanceGuides = async (query = {}) => {
  const guides = await MaintenanceGuide.find(query)
    .populate('requiredTools')
    .populate('relatedCodes')
    .sort({ createdAt: -1 });
  return guides;
};

const getMaintenanceGuideById = async (id) => {
  const guide = await MaintenanceGuide.findById(id)
    .populate('requiredTools')
    .populate('relatedCodes');
  if (!guide) {
    throw new ApiError('Maintenance guide not found', 404);
  }
  return guide;
};

const updateMaintenanceGuideById = async (id, data) => {
  parseGuideFields(data);
  const guide = await getMaintenanceGuideById(id);
  Object.assign(guide, data);
  await guide.save();
  return guide;
};

const deleteMaintenanceGuideById = async (id) => {
  const guide = await getMaintenanceGuideById(id);
  await MaintenanceGuide.deleteOne({ _id: id });
  return guide;
};

module.exports = {
  createMaintenanceGuide,
  getMaintenanceGuides,
  getMaintenanceGuideById,
  updateMaintenanceGuideById,
  deleteMaintenanceGuideById,
};
