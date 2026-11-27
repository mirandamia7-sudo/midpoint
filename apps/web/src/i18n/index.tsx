/* i18n: the UI's words come from translation catalogs, never from the components. Spanish is the
   source and the default (src/i18n/messages/es); English and Brazilian Portuguese mirror it key
   for key, which the catalogs' types enforce at compile time and tests/unit/i18n.test.ts checks
   at run time (keys, non-empty values, matching {placeholders}). The product's name is never
   written in a catalog: strings say `{brand}` and get it from src/lib/brand.ts.

   The language: `?lang=xx` in the address, else the visitor's saved choice, else Spanish. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import es from '@/i18n/messages/es';
import en from '@/i18n/messages/en';
import pt from '@/i18n/messages/pt';
import { withBrand } from '@/lib/brand';

export type Messages = typeof es;
export const LANGS = ['es', 'en', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
/** The catalogs as written: `{brand}` where the product's name goes. */
export const RAW_CATALOGS: Record<Lang, Messages> = { es, en, pt };
/** The catalogs the screens read, with the product's name filled in (src/lib/brand.ts). */
export const CATALOGS: Record<Lang, Messages> = {
  es: withBrand(es),
  en: withBrand(en),
  pt: withBrand(pt),
};
export const DEFAULT_LANG: Lang = 'es';

const STORAGE_KEY = 'midpoint.lang';

export const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export { fmt } from '@/i18n/format';

/** The language to start with: the address's `?lang=`, the saved choice, else Spanish. */
export function initialLang(search = typeof location === 'undefined' ? '' : location.search): Lang {
  try {
    const fromUrl = new URLSearchParams(search).get('lang');
    if (isLang(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked: the default */
  }
  return DEFAULT_LANG;
}

interface I18nValue {
  lang: Lang;
  t: Messages;
  setLang: (lang: Lang) => void;
}

// Outside the provider (or a context left behind by a hot reload) the words still carry the
// product's name: never the raw catalog with `{brand}` in it.
const I18nContext = createContext<I18nValue>({
  lang: DEFAULT_LANG,
  t: CATALOGS[DEFAULT_LANG],
  setLang: () => {},
});

export function I18nProvider({ children, lang: forced }: { children: ReactNode; lang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => forced ?? initialLang());
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    // A language picked through the address (`?lang=en`) holds as the person navigates on.
    try {
      if (new URLSearchParams(location.search).has('lang')) localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage blocked: the address keeps deciding */
    }
  }, [lang]);
  const value = useMemo(() => ({ lang, t: CATALOGS[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
export const useLang = () => useContext(I18nContext).lang;

/** The page's title and description in the reader's language. */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
}
