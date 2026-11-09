// "Not interested" menu labels across YouTube UI languages; matched after whitespace normalization.
export const NOT_INTERESTED_LABELS = [
  'Not interested',
  '興味なし',
  'Kein Interesse',
  'Pas intéressé',
  'No me interesa',
  'Não tenho interesse',
  'Non mi interessa',
  '관심 없음',
  '不感兴趣',
  '不感興趣',
  'Не интересует',
  'İlgilenmiyorum',
  'Niet geïnteresseerd',
  'Nie interesuje mnie',
  'Tidak tertarik',
  'Không quan tâm',
  'ไม่สนใจ',
];

export function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
