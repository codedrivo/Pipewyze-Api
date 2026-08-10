const catchAsync = require('../../helpers/asyncErrorHandler');
const service = require('../../services/admin/plumbingCode.service');

const createPlumbingCode = catchAsync(async (req, res) => {
  const code = await service.createPlumbingCode(req.body);
  res.status(201).json({
    status: 201,
    message: 'Plumbing code created successfully',
    code,
  });
});

const getPlumbingCodes = catchAsync(async (req, res) => {
  const { category, search, limit, page } = req.query;
  const filter = {};
  if (category) {
    filter.category = category;
  }
  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { plainLanguageInterpretation: { $regex: search, $options: 'i' } },
    ];
  }
  const codes = await service.getPlumbingCodes(filter, { limit, page });

  const PlumbingCodeCategory = require('../../models/plumbingCodeCategory.model');
  const categories = await PlumbingCodeCategory.find();
  const categoryMap = new Map(categories.map((c) => [c.name, c.fullName]));

  let codesWithSaved = codes;
  if (req.user) {
    const SavedResource = require('../../models/savedResource.model');
    const savedResources = await SavedResource.find({
      userId: req.user._id,
      resourceType: 'PlumbingCode',
      resourceId: { $in: codes.map((c) => c._id) },
    });
    const savedResourceIds = new Set(
      savedResources.map((sr) => sr.resourceId.toString()),
    );
    codesWithSaved = codes.map((code) => {
      const codeJson = code.toJSON ? code.toJSON() : code;
      codeJson.isSaved = savedResourceIds.has(code._id.toString());
      codeJson.categoryFullName = categoryMap.get(code.category) || '';
      return codeJson;
    });
  } else {
    codesWithSaved = codes.map((code) => {
      const codeJson = code.toJSON ? code.toJSON() : code;
      codeJson.categoryFullName = categoryMap.get(code.category) || '';
      return codeJson;
    });
  }
  res.status(200).json({
    status: 200,
    codes: codesWithSaved,
  });
});

const getPlumbingCode = catchAsync(async (req, res) => {
  const code = await service.getPlumbingCodeById(req.params.id);
  let codeJson = code.toJSON ? code.toJSON() : code;

  const PlumbingCodeCategory = require('../../models/plumbingCodeCategory.model');
  const categoryDoc = await PlumbingCodeCategory.findOne({
    name: code.category,
  });
  codeJson.categoryFullName = categoryDoc ? categoryDoc.fullName : '';

  if (req.user) {
    const SavedResource = require('../../models/savedResource.model');
    const isSaved = await SavedResource.exists({
      userId: req.user._id,
      resourceType: 'PlumbingCode',
      resourceId: code._id,
    });
    codeJson.isSaved = !!isSaved;
  }
  res.status(200).json({
    status: 200,
    code: codeJson,
  });
});

const updatePlumbingCode = catchAsync(async (req, res) => {
  const code = await service.updatePlumbingCodeById(req.params.id, req.body);
  res.status(200).json({
    status: 200,
    message: 'Plumbing code updated successfully',
    code,
  });
});

const deletePlumbingCode = catchAsync(async (req, res) => {
  await service.deletePlumbingCodeById(req.params.id);
  res.status(200).json({
    status: 200,
    message: 'Plumbing code deleted successfully',
  });
});

module.exports = {
  createPlumbingCode,
  getPlumbingCodes,
  getPlumbingCode,
  updatePlumbingCode,
  deletePlumbingCode,
};
