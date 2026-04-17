require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');

const Card = require('../models/Card');
const Pack = require('../models/Pack');
const { buildHint, guessDifficulty, hashBuffer, normalizeSlug, deleteCharacterCards, VALID_CATEGORIES } = require('../services/cardsService');

function parseArgs(argv) {
  const out = { source: null, dest: path.join(__dirname, '..', 'assets'), renameSource: false, writeDb: true, reset: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') out.source = argv[i + 1], (i += 1);
    else if (a === '--dest') out.dest = argv[i + 1], (i += 1);
    else if (a === '--rename-source') out.renameSource = true;
    else if (a === '--no-db') out.writeDb = false;
    else if (a === '--reset') out.reset = true;
  }
  if (!out.source) throw new Error('MISSING_SOURCE. Use --source <path>');
  return out;
}

const AR_NAME = {
  apple: { name: 'تفاحة', clue: 'لونها أحمر غالبًا' },
  banana: { name: 'موز', clue: 'لونها أصفر غالبًا' },
  orange: { name: 'برتقال', clue: 'لونها برتقالي غالبًا' },
  strawberry: { name: 'فراولة', clue: 'صغيرة وبها بذور' },
  grapes: { name: 'عنب', clue: 'بتكون في عناقيد' },
  pear: { name: 'كمثرى', clue: 'شكلها كمثري' },
  mango: { name: 'مانجو', clue: 'فاكهة صيفية' },
  pineapple: { name: 'أناناس', clue: 'عليها تاج أخضر' },
  watermelon: { name: 'بطيخ', clue: 'قشرته خضراء من بره' },
  cherry: { name: 'كرز', clue: 'صغيرة وحمراء' },

  tomato: { name: 'طماطم', clue: 'تستخدم في السلطة' },
  cucumber: { name: 'خيار', clue: 'أخضر وطويل' },
  carrot: { name: 'جزر', clue: 'برتقالي وطويل' },
  broccoli: { name: 'بروكلي', clue: 'زي شجرة صغيرة' },
  lettuce: { name: 'خس', clue: 'ورقي وأخضر' },
  onion: { name: 'بصل', clue: 'بيخلّيك تعيط' },
  potato: { name: 'بطاطس', clue: 'تتعمل مقلية' },
  eggplant: { name: 'باذنجان', clue: 'لونه بنفسجي غالبًا' },
  pepper: { name: 'فلفل', clue: 'ممكن يكون حار أو حلو' },
  corn: { name: 'ذرة', clue: 'حباتها صفرا' },

  burger: { name: 'برجر', clue: 'سندوتش لحم' },
  pizza: { name: 'بيتزا', clue: 'جبنة على العجين' },
  pasta: { name: 'مكرونة', clue: 'بتتعمل بصوص' },
  sushi: { name: 'سوشي', clue: 'أكل ياباني' },
  taco: { name: 'تاكو', clue: 'أكلة مكسيكية' },
  hot_dog: { name: 'هوت دوج', clue: 'سجق في عيش' },
  ice_cream: { name: 'آيس كريم', clue: 'بارد وحلو' },
  donut: { name: 'دونات', clue: 'دائري ومغطى' },
  cupcake: { name: 'كب كيك', clue: 'كيك صغير' },
  croissant: { name: 'كرواسون', clue: 'معجنات هلالية' },

  cat: { name: 'قطة', clue: 'بتقول مياو' },
  dog: { name: 'كلب', clue: 'وفيّ وبيهوهو' },
  elephant: { name: 'فيل', clue: 'عنده خرطوم' },
  giraffe: { name: 'زرافة', clue: 'رقبتها طويلة' },
  lion: { name: 'أسد', clue: 'ملك الغابة' },
  tiger: { name: 'نمر', clue: 'عنده خطوط' },
  monkey: { name: 'قرد', clue: 'بيحب الموز' },
  panda: { name: 'باندا', clue: 'أسود وأبيض' },
  penguin: { name: 'بطريق', clue: 'بيعيش في البرد' },
  rabbit: { name: 'أرنب', clue: 'بيأكل جزر' },

  laptop: { name: 'لاب توب', clue: 'كمبيوتر محمول' },
  tv: { name: 'تلفزيون', clue: 'لمشاهدة البرامج' },
  alarm_clock: { name: 'ساعة منبه', clue: 'بتصحّي من النوم' },
  light_bulb: { name: 'لمبة', clue: 'بتنّور المكان' },
  car: { name: 'عربية', clue: 'وسيلة مواصلات' },
  table: { name: 'ترابيزة', clue: 'بنحط عليها حاجات' },
  chair: { name: 'كرسي', clue: 'بنقعد عليه' }
};

const CATEGORY_BY_ITEM = {
  apple: 'fruit',
  banana: 'fruit',
  orange: 'fruit',
  strawberry: 'fruit',
  grapes: 'fruit',
  pear: 'fruit',
  mango: 'fruit',
  pineapple: 'fruit',
  watermelon: 'fruit',
  cherry: 'fruit',

  tomato: 'vegetable',
  cucumber: 'vegetable',
  carrot: 'vegetable',
  broccoli: 'vegetable',
  lettuce: 'vegetable',
  onion: 'vegetable',
  potato: 'vegetable',
  eggplant: 'vegetable',
  pepper: 'vegetable',
  corn: 'vegetable',

  burger: 'food',
  pizza: 'food',
  pasta: 'food',
  sushi: 'food',
  taco: 'food',
  hot_dog: 'food',
  ice_cream: 'food',
  donut: 'food',
  cupcake: 'food',
  croissant: 'food',

  cat: 'animal',
  dog: 'animal',
  elephant: 'animal',
  giraffe: 'animal',
  lion: 'animal',
  tiger: 'animal',
  monkey: 'animal',
  panda: 'animal',
  penguin: 'animal',
  rabbit: 'animal',

  laptop: 'object',
  tv: 'object',
  alarm_clock: 'object',
  light_bulb: 'object',
  car: 'object',
  table: 'object',
  chair: 'object'
};

const STOPWORDS = new Set([
  'single',
  'centered',
  'bright',
  'clean',
  'soft',
  'gradient',
  'background',
  'mobile',
  'game',
  'asset',
  'style',
  'cartoon',
  'realistic',
  'high',
  'quality',
  'ratio',
  'no',
  'text',
  'watermark',
  'other',
  'objects',
  'fresh',
  'juicy',
  'classic',
  'whole',
  'slice',
  'wedge',
  'with',
  'and',
  'a',
  'of',
  'color',
  'shiny',
  'skin',
  'modern',
  'thin',
  'bezel',
  'simple',
  'wooden',
  'design',
  'character',
  'cute',
  'friendly',
  'sitting',
  'standing',
  'majestic',
  'playful',
  'long',
  'neck',
  'black',
  'white',
  'orange',
  'red',
  'green',
  'purple',
  'yellow',
  'brown',
  'grey',
  'golden',
  'deep',
  'ripe',
  'vibrant'
]);

function extractItemFromDir(dirName) {
  const raw = String(dirName ?? '');
  let token = raw;
  if (token.startsWith('single_')) token = token.slice('single_'.length);
  const centeredIdx = token.indexOf('_centered');
  if (centeredIdx >= 0) token = token.slice(0, centeredIdx);
  token = token.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
  const parts = token.split('_').filter(Boolean).filter((p) => !STOPWORDS.has(p));
  if (!parts.length) return null;
  const candidates = [
    parts.join('_'),
    parts[parts.length - 1],
    parts.slice(-2).join('_')
  ].map(normalizeSlug);
  const uniq = Array.from(new Set(candidates)).filter(Boolean);
  for (const c of uniq) {
    if (CATEGORY_BY_ITEM[c]) return c;
  }
  return uniq[0] ?? null;
}

function normalizeItem(item) {
  const s = normalizeSlug(item);
  if (s.endsWith('_character')) return s.replace(/_character$/, '');
  if (s === 'bell_pepper') return 'pepper';
  if (s === 'ear_of_corn') return 'corn';
  if (s === 'fresh_tomato') return 'tomato';
  if (s === 'red_apple') return 'apple';
  if (s === 'orange_fruit') return 'orange';
  if (s === 'fruit') return 'orange';
  if (s === 'bunch_of_grapes') return 'grapes';
  if (s === 'cherry_on_stem') return 'cherry';
  if (s === 'head_of_lettuce') return 'lettuce';
  if (s === 'plate_of_pasta') return 'pasta';
  if (s === 'ice_cream_cone') return 'ice_cream';
  if (s === 'sushi_roll') return 'sushi';
  if (s === 'broccoli_floret') return 'broccoli';
  if (s === 'flat_screen_tv') return 'tv';
  if (s === 'office_table') return 'table';
  if (s === 'wooden_chair') return 'chair';
  if (s === 'modern_car') return 'car';
  if (s === 'laptop_computer') return 'laptop';
  if (s === 'classic_alarm_clock') return 'alarm_clock';
  return s;
}

function guessCategory(itemSlug, dirName) {
  const d = String(dirName ?? '').toLowerCase();
  if (d.includes('_character_')) return 'animal';
  const c = CATEGORY_BY_ITEM[itemSlug] ?? null;
  if (c) return c;
  return 'object';
}

function arabicNameFor(itemSlug) {
  const v = AR_NAME[itemSlug];
  if (v?.name) return { name: v.name, clue: v.clue ?? null };
  return { name: itemSlug.replace(/_/g, ' '), clue: null };
}

async function walkFiles(root) {
  const out = [];
  async function rec(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) await rec(fp);
      else out.push(fp);
    }
  }
  await rec(root);
  return out;
}

async function ensureDirs(destRoot) {
  const dirs = ['fruits', 'vegetables', 'foods', 'animals', 'objects'].map((d) => path.join(destRoot, d));
  for (const d of dirs) await fs.mkdir(d, { recursive: true });
}

async function clearAssets(destRoot) {
  const dirs = ['fruits', 'vegetables', 'foods', 'animals', 'objects'].map((d) => path.join(destRoot, d));
  for (const d of dirs) {
    try {
      const entries = await fs.readdir(d);
      for (const f of entries) {
        if (!/\.(png|jpg|jpeg|webp)$/i.test(f)) continue;
        await fs.unlink(path.join(d, f)).catch(() => null);
      }
    } catch {}
  }
}

function categoryDir(category) {
  if (category === 'fruit') return 'fruits';
  if (category === 'vegetable') return 'vegetables';
  if (category === 'food') return 'foods';
  if (category === 'animal') return 'animals';
  return 'objects';
}

async function main() {
  const args = parseArgs(process.argv);
  await ensureDirs(args.dest);
  if (args.reset) await clearAssets(args.dest);

  if (args.writeDb) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI_REQUIRED');
    if (String(process.env.MONGODB_URI).startsWith('mongodb+srv://')) {
      const serversRaw = String(process.env.MONGODB_DNS_SERVERS ?? '1.1.1.1,8.8.8.8');
      const servers = serversRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (servers.length) dns.setServers(servers);
    }
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined });
    if (args.reset) {
      await Card.deleteMany({ category: { $in: Array.from(VALID_CATEGORIES) } });
      await Pack.deleteMany({});
    }
  }

  const files = await walkFiles(args.source);
  const images = files.filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

  const counters = new Map();
  const imported = [];

  for (const src of images) {
    const base = path.basename(src);
    if (base.toLowerCase() === 'design.md') continue;
    const parent = path.basename(path.dirname(src));
    const itemFromDir = extractItemFromDir(parent) ?? extractItemFromDir(path.basename(src)) ?? null;
    if (!itemFromDir) continue;
    const item = normalizeItem(itemFromDir);
    const category = guessCategory(item, parent);
    if (!VALID_CATEGORIES.has(category)) continue;

    const indexKey = `${category}:${item}`;
    const next = (counters.get(indexKey) ?? 0) + 1;
    counters.set(indexKey, next);
    const idx = String(next).padStart(2, '0');
    const fileName = `${category}_${item}_${idx}${path.extname(src).toLowerCase() || '.png'}`;
    const destDir = path.join(args.dest, categoryDir(category));
    const destPath = path.join(destDir, fileName);
    const relPath = `/assets/${categoryDir(category)}/${fileName}`;

    const buf = await fs.readFile(src);
    await fs.writeFile(destPath, buf);

    if (args.renameSource) {
      const renamedSource = path.join(path.dirname(src), fileName);
      if (renamedSource !== src) await fs.rename(src, renamedSource).catch(() => null);
    }

    const { name: nameAr, clue } = arabicNameFor(item);
    const slug = normalizeSlug(item);
    const hint = buildHint({ category, nameAr, clue });
    const difficulty = guessDifficulty(category, slug);
    const sourceHash = hashBuffer(buf);

    if (args.writeDb) {
      await Card.findOneAndUpdate(
        { category, slug },
        { $set: { name: nameAr, category, imagePath: relPath, hint, difficulty, slug, sourceHash } },
        { upsert: true, new: true }
      ).lean();
    }

    imported.push({ category, slug, name: nameAr, imagePath: relPath });
  }

  if (args.writeDb) {
    await deleteCharacterCards();
    await Pack.deleteMany({ key: 'character' });
    await Pack.findOneAndUpdate({ key: 'mixed' }, { $setOnInsert: { key: 'mixed', name: 'Mixed Pack', categories: Array.from(VALID_CATEGORIES) } }, { upsert: true });
    await mongoose.disconnect();
  }

  const outJson = path.join(args.dest, 'cards.import.json');
  await fs.writeFile(outJson, JSON.stringify({ count: imported.length, cards: imported }, null, 2), 'utf8');
  process.stdout.write(`Imported ${imported.length} cards\n`);
  process.stdout.write(`Wrote ${outJson}\n`);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exit(1);
});
