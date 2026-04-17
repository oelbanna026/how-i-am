const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    friendId: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

FriendRequestSchema.index({ userId: 1, friendId: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);

