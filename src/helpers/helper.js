const mongoose = require('mongoose');
const toObjectIdArray = (arr) =>
  arr.map((id) => new mongoose.Types.ObjectId(id));
module.exports = {
  toObjectIdArray,
};
