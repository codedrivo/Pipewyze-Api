const mongoose = require('mongoose');
const Slug = require('mongoose-slug-generator');
mongoose.plugin(Slug);
const User = require('./user.model');
const pageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: User,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: { type: String, slug: 'title' },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const Page = mongoose.model('Page', pageSchema);
module.exports = Page;
