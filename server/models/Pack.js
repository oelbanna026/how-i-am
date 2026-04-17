const mongoose = require('mongoose');

const PackSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    categories: { type: [String], required: true, default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pack', PackSchema);

