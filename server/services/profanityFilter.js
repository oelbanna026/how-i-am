const AR = [
  'كس',
  'كسم',
  'متناك',
  'خول',
  'شرموط',
  'شرموطة',
  'زاني',
  'زانية',
  'ابن القحبة',
  'قحبة',
  'منيوك',
  'منيك',
  'ياحيوان'
];

const EN = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'nigger', 'faggot'];

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WORDS = [...AR, ...EN].filter(Boolean);
const RX = WORDS.length
  ? new RegExp(`\\b(${WORDS.map(escapeRegExp).join('|')})\\b`, 'gi')
  : null;

function sanitizeText(text) {
  const t = String(text ?? '');
  if (!RX) return t;
  return t.replace(RX, (m) => '*'.repeat(Math.max(4, m.length)));
}

module.exports = { sanitizeText };

