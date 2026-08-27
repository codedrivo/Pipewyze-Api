const EssentialTool = require('../../models/essentialTool.model');
const ApiError = require('../../helpers/apiErrorConverter');
const notificationService = require('../notification.service');

const parseArrayFields = (data) => {
  const fields = ['bestUsedFor', 'howToUse', 'safetyTips'];
  fields.forEach((field) => {
    if (typeof data[field] === 'string') {
      try {
        data[field] = JSON.parse(data[field]);
      } catch (e) {
        if (data[field].trim() === '') {
          data[field] = [];
        } else {
          data[field] = data[field]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }
  });
};

const createEssentialTool = async (data) => {
  parseArrayFields(data);
  const tool = await EssentialTool.create(data);

  // Send push notification to all target roles
  const roles = ['home-owner', 'apprentice', 'licensed-plumber'];
  roles.forEach((role) => {
    notificationService
      .sendToRole(
        role,
        'New Essential Tool Available',
        `A new essential tool "${tool.name}" has been added by the Admin.`,
        { toolId: tool._id.toString() },
      )
      .catch((err) =>
        console.error(
          `Failed sending notification to ${role} on tool creation:`,
          err.message,
        ),
      );
  });

  return tool;
};

const getEssentialTools = async (query = {}) => {
  const tools = await EssentialTool.find(query).sort({ createdAt: -1 });
  return tools;
};

const getEssentialToolById = async (id) => {
  const tool = await EssentialTool.findById(id);
  if (!tool) {
    throw new ApiError('Essential Tool not found', 404);
  }
  return tool;
};

const updateEssentialToolById = async (id, data) => {
  parseArrayFields(data);
  const tool = await getEssentialToolById(id);
  Object.assign(tool, data);
  await tool.save();
  return tool;
};

const deleteEssentialToolById = async (id) => {
  const tool = await getEssentialToolById(id);
  await EssentialTool.deleteOne({ _id: id });
  const SavedResource = require('../../models/savedResource.model');
  await SavedResource.deleteMany({ resourceId: id });
  return tool;
};

module.exports = {
  createEssentialTool,
  getEssentialTools,
  getEssentialToolById,
  updateEssentialToolById,
  deleteEssentialToolById,
};
