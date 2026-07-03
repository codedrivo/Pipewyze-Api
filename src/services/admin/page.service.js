const ApiError = require('../../helpers/apiErrorConverter');
const Page = require('../../models/page.model');

const pageListFind = async (limit = 10, page = 1, searchQuery = '') => {
  try {
    const query = {};
    if (searchQuery) {
      const sanitizedSearchTerm = searchQuery.replace(/"/g, '');
      query.$or = [
        { title: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { description: { $regex: sanitizedSearchTerm, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const totalItems = await Page.find(query).countDocuments();
    const pages = await Page.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const pageList = {
      pages,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
      totalResults: totalItems,
    };

    return pageList;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const page = async (id, data) => {
  try {
    pageData = await Page.create(data);
    return pageData;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const viewPage = async (id) => {
  try {
    const pageDetail = await Page.findById(id);
    return pageDetail;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const updatePage = async (id, data) => {
  try {
    const result = await Page.findOneAndUpdate({ _id: id }, data, {
      new: true,
    });
    if (!result) {
      throw new ApiError('Data not found', 404);
    }
    return result;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

const deletePage = async (id) => {
  try {
    const result = await Page.deleteOne({ _id: id });
    if (!result) {
      throw new ApiError('Data not found', 404);
    }
    return result;
  } catch (e) {
    throw new ApiError(e.message, 404);
  }
};

module.exports = {
  page,
  viewPage,
  updatePage,
  deletePage,
  pageListFind,
};
