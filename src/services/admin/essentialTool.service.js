const EssentialTool = require('../../models/essentialTool.model');
const ApiError = require('../../helpers/apiErrorConverter');

const createEssentialTool = async (data) => {
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
