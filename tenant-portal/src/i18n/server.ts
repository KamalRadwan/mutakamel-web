import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { LANGUAGE_KEY, languageOrDefault, type Language, type LanguageSnapshot } from "./dictionary-store";

// React's request cache lets metadata and layouts share the selected copy
// without keeping one request's language in process-global mutable state.
export const readServerLanguage = cache(async (): Promise<Language> =>
  languageOrDefault((await cookies()).get(LANGUAGE_KEY)?.value));

// Server-only consumers (metadata) read the dictionary here. It never crosses
// into a client prop: dictionaries hold formatter functions, which React
// cannot serialize, so the root layout hands the provider only the language.
export const loadServerLanguage = cache(async (): Promise<LanguageSnapshot> => {
  const lang = await readServerLanguage();
  const loaders = {
    ar: () => import("./dictionaries/ar").then((module) => module.ar),
    en: () => import("./dictionaries/en").then((module) => module.en),
  };
  return { lang, dictionary: await loaders[lang]() };
});
