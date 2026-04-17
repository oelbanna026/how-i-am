const mongoose = require('mongoose');

const GameRecordSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    mode: { type: String, required: true },
    category: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    winnerId: { type: String, required: true },
    players: {
      type: [
        {
          playerId: { type: String, required: true },
          name: { type: String, required: true },
          score: { type: Number, required: true },
          cardName: { type: String, required: true },
          cardCategory: { type: String, required: true }
        }
      ],
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameRecord', GameRecordSchema);

