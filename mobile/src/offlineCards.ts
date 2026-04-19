import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { normalizeCardCategory, normalizeCardImagePath } from './cardImages';

export type OfflineCard = {
  id: string;
  category: string;
  slug: string;
  name: string;
  image: string;
  imagePath: string;
};

const offlineData = require('../assets/offline_cards/cards.import.json') as { cards?: OfflineCard[] };

export const offlineCards: OfflineCard[] = Array.isArray(offlineData?.cards)
  ? offlineData.cards
      .map((card, index) => {
        const category = normalizeCardCategory(card?.category);
        const slug = String(card?.slug ?? '').trim();
        const imagePath = normalizeCardImagePath((card as any)?.imagePath ?? (card as any)?.image) ?? '';
        return {
          ...card,
          id: String((card as any)?.id ?? `${category}:${slug || index}`),
          category,
          slug,
          image: imagePath,
          imagePath
        };
      })
      .filter((card) => Boolean(card.imagePath))
  : [];

const imageModules: Record<string, number> = {
  '/assets/animals/animal_cat_01.png': require('../assets/offline_cards/animals/animal_cat_01.png'),
  '/assets/animals/animal_dog_01.png': require('../assets/offline_cards/animals/animal_dog_01.png'),
  '/assets/animals/animal_elephant_01.png': require('../assets/offline_cards/animals/animal_elephant_01.png'),
  '/assets/animals/animal_giraffe_01.png': require('../assets/offline_cards/animals/animal_giraffe_01.png'),
  '/assets/animals/animal_lion_01.png': require('../assets/offline_cards/animals/animal_lion_01.png'),
  '/assets/animals/animal_monkey_01.png': require('../assets/offline_cards/animals/animal_monkey_01.png'),
  '/assets/animals/animal_panda_01.png': require('../assets/offline_cards/animals/animal_panda_01.png'),
  '/assets/animals/animal_penguin_01.png': require('../assets/offline_cards/animals/animal_penguin_01.png'),
  '/assets/animals/animal_rabbit_01.png': require('../assets/offline_cards/animals/animal_rabbit_01.png'),
  '/assets/animals/animal_tiger_01.png': require('../assets/offline_cards/animals/animal_tiger_01.png'),

  '/assets/foods/food_burger_01.png': require('../assets/offline_cards/foods/food_burger_01.png'),
  '/assets/foods/food_croissant_01.png': require('../assets/offline_cards/foods/food_croissant_01.png'),
  '/assets/foods/food_cupcake_01.png': require('../assets/offline_cards/foods/food_cupcake_01.png'),
  '/assets/foods/food_donut_01.png': require('../assets/offline_cards/foods/food_donut_01.png'),
  '/assets/foods/food_hot_dog_01.png': require('../assets/offline_cards/foods/food_hot_dog_01.png'),
  '/assets/foods/food_ice_cream_01.png': require('../assets/offline_cards/foods/food_ice_cream_01.png'),
  '/assets/foods/food_pasta_01.png': require('../assets/offline_cards/foods/food_pasta_01.png'),
  '/assets/foods/food_pizza_01.png': require('../assets/offline_cards/foods/food_pizza_01.png'),
  '/assets/foods/food_sushi_01.png': require('../assets/offline_cards/foods/food_sushi_01.png'),
  '/assets/foods/food_taco_01.png': require('../assets/offline_cards/foods/food_taco_01.png'),

  '/assets/fruits/fruit_apple_01.png': require('../assets/offline_cards/fruits/fruit_apple_01.png'),
  '/assets/fruits/fruit_banana_01.png': require('../assets/offline_cards/fruits/fruit_banana_01.png'),
  '/assets/fruits/fruit_cherry_01.png': require('../assets/offline_cards/fruits/fruit_cherry_01.png'),
  '/assets/fruits/fruit_grapes_01.png': require('../assets/offline_cards/fruits/fruit_grapes_01.png'),
  '/assets/fruits/fruit_mango_01.png': require('../assets/offline_cards/fruits/fruit_mango_01.png'),
  '/assets/fruits/fruit_orange_01.png': require('../assets/offline_cards/fruits/fruit_orange_01.png'),
  '/assets/fruits/fruit_pear_01.png': require('../assets/offline_cards/fruits/fruit_pear_01.png'),
  '/assets/fruits/fruit_pineapple_01.png': require('../assets/offline_cards/fruits/fruit_pineapple_01.png'),
  '/assets/fruits/fruit_strawberry_01.png': require('../assets/offline_cards/fruits/fruit_strawberry_01.png'),
  '/assets/fruits/fruit_watermelon_01.png': require('../assets/offline_cards/fruits/fruit_watermelon_01.png'),

  '/assets/objects/object_alarm_clock_01.png': require('../assets/offline_cards/objects/object_alarm_clock_01.png'),
  '/assets/objects/object_car_01.png': require('../assets/offline_cards/objects/object_car_01.png'),
  '/assets/objects/object_chair_01.png': require('../assets/offline_cards/objects/object_chair_01.png'),
  '/assets/objects/object_laptop_01.png': require('../assets/offline_cards/objects/object_laptop_01.png'),
  '/assets/objects/object_light_bulb_01.png': require('../assets/offline_cards/objects/object_light_bulb_01.png'),
  '/assets/objects/object_table_01.png': require('../assets/offline_cards/objects/object_table_01.png'),
  '/assets/objects/object_tv_01.png': require('../assets/offline_cards/objects/object_tv_01.png'),

  '/assets/vegetables/vegetable_broccoli_01.png': require('../assets/offline_cards/vegetables/vegetable_broccoli_01.png'),
  '/assets/vegetables/vegetable_carrot_01.png': require('../assets/offline_cards/vegetables/vegetable_carrot_01.png'),
  '/assets/vegetables/vegetable_corn_01.png': require('../assets/offline_cards/vegetables/vegetable_corn_01.png'),
  '/assets/vegetables/vegetable_cucumber_01.png': require('../assets/offline_cards/vegetables/vegetable_cucumber_01.png'),
  '/assets/vegetables/vegetable_eggplant_01.png': require('../assets/offline_cards/vegetables/vegetable_eggplant_01.png'),
  '/assets/vegetables/vegetable_lettuce_01.png': require('../assets/offline_cards/vegetables/vegetable_lettuce_01.png'),
  '/assets/vegetables/vegetable_onion_01.png': require('../assets/offline_cards/vegetables/vegetable_onion_01.png'),
  '/assets/vegetables/vegetable_pepper_01.png': require('../assets/offline_cards/vegetables/vegetable_pepper_01.png'),
  '/assets/vegetables/vegetable_potato_01.png': require('../assets/offline_cards/vegetables/vegetable_potato_01.png'),
  '/assets/vegetables/vegetable_tomato_01.png': require('../assets/offline_cards/vegetables/vegetable_tomato_01.png')
};

const imageUriCache = new Map<string, Promise<string | null>>();
const imageDataUriCache = new Map<string, Promise<string | null>>();

export async function offlineImageUri(imagePath: string | null | undefined) {
  const p = normalizeCardImagePath(imagePath);
  if (!p) return null;
  if (/^(?:https?:|data:|file:|blob:)/i.test(p)) return p;
  const cached = imageUriCache.get(p);
  if (cached) return cached;
  const mod = imageModules[p];
  if (!mod) return null;
  const loading = (async () => {
    const asset = Asset.fromModule(mod);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  })();
  imageUriCache.set(p, loading);
  return loading;
}

export async function offlineImageDataUri(imagePath: string | null | undefined) {
  const p = normalizeCardImagePath(imagePath);
  if (!p) return null;
  if (/^data:/i.test(p)) return p;
  const cached = imageDataUriCache.get(p);
  if (cached) return cached;
  const loading = (async () => {
    const uri = await offlineImageUri(p);
    if (!uri) return null;
    if (/^data:/i.test(uri)) return uri;
    if (!uri.startsWith('file:')) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64'
    });
    const ext = p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
    return `data:image/${ext};base64,${base64}`;
  })();
  imageDataUriCache.set(p, loading);
  return loading;
}

function shuffleCards<T>(cards: T[]) {
  const next = cards.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

export function getOfflineCardsForCategory(categoryRaw: string | null | undefined) {
  const category = normalizeCardCategory(categoryRaw);
  if (category === 'All') return offlineCards.slice();
  return offlineCards.filter((card) => normalizeCardCategory(card.category) === category);
}

export function pickDistinctOfflineCards(categoryRaw: string | null | undefined) {
  const pool = shuffleCards(getOfflineCardsForCategory(categoryRaw));
  const userCard = pool[0] ?? null;
  const botCard = pool.find((card) => String(card.slug) !== String(userCard?.slug ?? '')) ?? null;
  return { userCard, botCard };
}

export async function preloadOfflineCardDataUris(cards: Array<{ imagePath?: string | null; image?: string | null } | null | undefined>) {
  await Promise.all(cards.map((card) => offlineImageDataUri(card?.imagePath ?? card?.image ?? null)));
}
