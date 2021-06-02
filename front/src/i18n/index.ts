import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './locales';

let lng = "en";
const lastLang = window.localStorage.getItem("lastLang");

if(lastLang && (resources as any)[lastLang]) {
    lng = lastLang;
}

i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    defaultNS: "default",
    fallbackNS: "default",
    react: {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['a', 'i', 'span', 'strong']
    },
});

i18n.on('languageChanged', lang => {
    window.localStorage.setItem("lastLang", lang);
});

export default i18n;