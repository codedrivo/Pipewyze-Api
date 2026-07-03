const Joi = require('joi');

// Save settings data
const saveSetting = Joi.object({
  sitelogo: Joi.optional(),
  footerlogo: Joi.optional(),
  footerContent: Joi.string().optional(),
  copyright: Joi.string().optional(),
  adminEmail: Joi.optional(),
  instagramUrl: Joi.optional(),
  twitterUrl: Joi.optional(),
  linkedinUrl: Joi.optional(),
  tiktok: Joi.optional(),
});

module.exports = {
  saveSetting,
};
