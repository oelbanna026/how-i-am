const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    imagePath: { type: String, required: true },
    hint: { type: Object, required: true },
    difficulty: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    sourceHash: { type: String, required: false, index: true }
  },
  { timestamps: true }
);

CardSchema.index({ category: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Card', CardSchema);

