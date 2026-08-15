const FAQ = require('../../models/faq.model');
const ApiError = require('../../helpers/apiErrorConverter');

const createFaq = async (data) => {
  const faq = await FAQ.create(data);
  return faq;
};

const getFaqs = async (searchQuery = '', page = 1, limit = 10) => {
  const query = {};
  if (searchQuery) {
    const sanitizedSearch = searchQuery.replace(/"/g, '');
    query.$or = [
      { question: { $regex: sanitizedSearch, $options: 'i' } },
      { answer: { $regex: sanitizedSearch, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const totalResults = await FAQ.countDocuments(query);
  const faqs = await FAQ.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    results: faqs,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const getFaqById = async (id) => {
  const faq = await FAQ.findById(id);
  if (!faq) {
    throw new ApiError('FAQ not found', 404);
  }
  return faq;
};

const updateFaqById = async (id, data) => {
  const faq = await getFaqById(id);
  Object.assign(faq, data);
  await faq.save();
  return faq;
};

const deleteFaqById = async (id) => {
  const faq = await getFaqById(id);
  await FAQ.deleteOne({ _id: id });
  return faq;
};

module.exports = {
  createFaq,
  getFaqs,
  getFaqById,
  updateFaqById,
  deleteFaqById,
};
