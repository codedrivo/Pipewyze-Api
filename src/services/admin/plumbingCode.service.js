const PlumbingCode = require('../../models/plumbingCode.model');
const ApiError = require('../../helpers/apiErrorConverter');

const createPlumbingCode = async (data) => {
  const code = await PlumbingCode.create(data);
  return code;
};

const getPlumbingCodes = async (filter = {}, options = {}) => {
  const limit = parseInt(options.limit, 10) || 10;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  const codes = await PlumbingCode.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  return codes;
};

const getPlumbingCodeById = async (id) => {
  const code = await PlumbingCode.findById(id);
  if (!code) {
    throw new ApiError('Plumbing Code not found', 404);
  }
  return code;
};

const updatePlumbingCodeById = async (id, data) => {
  const code = await getPlumbingCodeById(id);
  Object.assign(code, data);
  await code.save();
  return code;
};

const deletePlumbingCodeById = async (id) => {
  const code = await getPlumbingCodeById(id);
  await PlumbingCode.deleteOne({ _id: id });
  return code;
};

module.exports = {
  createPlumbingCode,
  getPlumbingCodes,
  getPlumbingCodeById,
  updatePlumbingCodeById,
  deletePlumbingCodeById,
};
