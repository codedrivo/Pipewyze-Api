const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const aiVideoQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

aiVideoQuestionSchema.plugin(toJSON);

const AiVideoQuestion = mongoose.model(
  'AiVideoQuestion',
  aiVideoQuestionSchema,
);

module.exports = AiVideoQuestion;
