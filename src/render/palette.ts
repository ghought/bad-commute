export const INK = {
  charcoal: '#23201d',
  soot: '#34302b',
  concrete: '#b5a188',
  concreteDark: '#8d7c67',
  teal: '#5a8783',
  tealDark: '#3a5a58',
  oxide: '#8c4f2d',
  oxideDark: '#5f3620',
  cream: '#e9dfc6',
  amber: '#efa21c',
  amberDark: '#b77510',
  blood: '#8e1216',
  bloodBright: '#b81a1c',
  bloodDark: '#560b0e',
  bone: '#ece4d0',
  steel: '#79807d',
  steelDark: '#4d5352',
  hazard: '#b3201c',
} as const;

export interface RiderPalette {
  id: string;
  name: string;
  /** Completed levels needed. 0 is the default. */
  unlockAt: number;
  jacket: string;
  jacketDark: string;
  stripe: string;
  trousers: string;
  trousersDark: string;
  helmet: string;
  helmetDark: string;
  bike: string;
  bikeDark: string;
}

export const PALETTES: RiderPalette[] = [
  { id: 'municipal', name: 'Municipal', unlockAt: 0, jacket: '#5a8783', jacketDark: '#3f615e', stripe: '#e9dfc6', trousers: '#4b4339', trousersDark: '#352f28', helmet: '#e9dfc6', helmetDark: '#b9ae93', bike: '#8c4f2d', bikeDark: '#5f3620' },
  { id: 'night-rate', name: 'Night Rate', unlockAt: 5, jacket: '#2f3a44', jacketDark: '#1f272e', stripe: '#efa21c', trousers: '#3b3a3c', trousersDark: '#28272a', helmet: '#3a4a57', helmetDark: '#27333d', bike: '#4d5352', bikeDark: '#33383a' },
  { id: 'hi-vis', name: 'Hi-Vis', unlockAt: 10, jacket: '#d98a12', jacketDark: '#a7680c', stripe: '#e9dfc6', trousers: '#39424b', trousersDark: '#272e35', helmet: '#efa21c', helmetDark: '#b77510', bike: '#3a5a58', bikeDark: '#27403f' },
  { id: 'long-service', name: 'Long Service', unlockAt: 20, jacket: '#e9dfc6', jacketDark: '#b9ae93', stripe: '#8e1216', trousers: '#23201d', trousersDark: '#141210', helmet: '#8e1216', helmetDark: '#5e0b0e', bike: '#23201d', bikeDark: '#141210' },
];
