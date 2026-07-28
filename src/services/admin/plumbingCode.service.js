const PlumbingCode = require('../../models/plumbingCode.model');
const ApiError = require('../../helpers/apiErrorConverter');

const createPlumbingCode = async (data) => {
  const code = await PlumbingCode.create(data);
  return code;
};

const getPlumbingCodes = async (filter = {}) => {
  const codes = await PlumbingCode.find(filter).sort({ createdAt: -1 });
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
