let cards = [];

function setCards(next) {
  cards = Array.isArray(next) ? next : [];
}

function getCards() {
  return cards;
}

module.exports = { setCards, getCards };

