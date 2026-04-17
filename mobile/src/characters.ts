import type { Category } from './types';

export type CharacterAttrs = {
  human: boolean;
  famous: boolean;
  gender: 'male' | 'female' | 'none';
  alive: boolean;
};

export type CharacterDef = {
  name: string;
  category: Category | string;
  attrs: CharacterAttrs;
};

export function imageUriForName(name: string) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/thumbs/png?seed=${seed}`;
}

export const characterPool: CharacterDef[] = [
  { name: 'تفاحة', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'موز', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'برتقال', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'فراولة', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'عنب', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'بطيخ', category: 'fruit', attrs: { human: false, famous: false, gender: 'none', alive: true } },

  { name: 'طماطم', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'خيار', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'جزر', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'بطاطس', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'بصل', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'فلفل', category: 'vegetable', attrs: { human: false, famous: false, gender: 'none', alive: true } },

  { name: 'بيتزا', category: 'food', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'برجر', category: 'food', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'مكرونة', category: 'food', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'سوشي', category: 'food', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'آيس كريم', category: 'food', attrs: { human: false, famous: false, gender: 'none', alive: false } },

  { name: 'قطة', category: 'animal', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'كلب', category: 'animal', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'أسد', category: 'animal', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'نمر', category: 'animal', attrs: { human: false, famous: false, gender: 'none', alive: true } },
  { name: 'فيل', category: 'animal', attrs: { human: false, famous: false, gender: 'none', alive: true } },

  { name: 'لاب توب', category: 'object', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'ساعة منبه', category: 'object', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'تلفزيون', category: 'object', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'كرسي', category: 'object', attrs: { human: false, famous: false, gender: 'none', alive: false } },
  { name: 'ترابيزة', category: 'object', attrs: { human: false, famous: false, gender: 'none', alive: false } }
];

export const categories: Array<Category> = [
  'All',
  'fruit',
  'vegetable',
  'food',
  'animal',
  'object'
];

export function pickUnique(category: Category | string, count: number) {
  const pool = category === 'All' ? characterPool : characterPool.filter((c) => c.category === category);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
