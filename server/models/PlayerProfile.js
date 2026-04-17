const mongoose = require('mongoose');

const PlayerProfileSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: Object, required: true },
    age: { type: Number, required: false, default: null },
    country: { type: String, required: false, default: null },
    coins: { type: Number, required: true, default: 100 },
    friends: { type: [String], required: false, default: [] },
    providers: { type: Object, required: false, default: {} },
    ui: { type: Object, required: false, default: {} },
    blockedUserIds: { type: [String], required: false, default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlayerProfile', PlayerProfileSchema);
