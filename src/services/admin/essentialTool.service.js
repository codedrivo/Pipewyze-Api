const EssentialTool = require('../../models/essentialTool.model');
const ApiError = require('../../helpers/apiErrorConverter');

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
  return tool;
};

const getEssentialTools = async () => {
  const tools = await EssentialTool.find({}).sort({ createdAt: -1 });
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
  return tool;
};

module.exports = {
  createEssentialTool,
  getEssentialTools,
  getEssentialToolById,
  updateEssentialToolById,
  deleteEssentialToolById,
};
