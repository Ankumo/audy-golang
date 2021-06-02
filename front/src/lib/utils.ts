import {store} from '../store';
import { createModal, rootActions } from '../store/reducers/root';
import { ClassCondition, TKey, Track, UserTheme } from './types';
import i18n from '../i18n';
import React from 'react';
import { AlertProps } from '../components/Helpers/Alert';
import en from '../i18n/locales/en';
import { StringMap, TOptions } from 'i18next';
import { nanoid } from '@reduxjs/toolkit';

type ProxyApiPart = "init" | "albumimage" | "avatar"

const volumeBase = 35;
let colorPicker: HTMLInputElement | null = null;
let favicon: HTMLLinkElement | null = null;

const utils = {
    proxy(addition: string) {
        return process.env.REACT_APP_PROXY + addition;
    },
    apiProxy(type: ProxyApiPart, addition?: string) {
        return utils.proxy("api/" + type + (addition ?? ""));
    },
    getLogVolume(volume: number) {
        //compute real volume value from base
        return (Math.pow(volumeBase, (volume / 100)) - 1) / (volumeBase - 1);
    },
    getRealVolume(volume: number) {
        //compute human-like volume precentage
        return Math.log((volumeBase - 1) * volume + 1) / Math.log(volumeBase);
    },
    alert(obj: AlertProps) {
        store.dispatch(rootActions.addAlert(obj));
    },
    alertError(key: TKey<"error">, message?: string) {
        const props: AlertProps = {
            tkey: `error:${key}`,
            accent: "error"
        };

        if(message && message.length > 0) {
            props.info = message;
            props.infoHeader = i18n.exists(`errorh:${key}`) ? i18n.t(`errorh:${key}`) : undefined;
        }

        utils.alert(props);
    },
    alertText(text: string) {
        utils.alert({text});
    },
    alertInfo(text: string) {
        utils.alert({
            text,
            accent: "info"
        });
    },
    alertWarn(text: string) {
        utils.alert({
            text,
            accent: "warning"
        });
    },
    getPickerValidColor(color: string) {
        let context = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);

        const pixel = context.getImageData(0, 0, 1, 1).data;

        if (pixel[3] < 255) {
            context.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
        }

        return context.fillStyle;
    },
    pickColor(x: number, y: number, initialValue?: string) {
        initialValue = this.getPickerValidColor(initialValue ?? "#000");

        return new Promise<string | null>(r => {
            if (colorPicker == null) {
                colorPicker = document.querySelector('input.global-color-picker') as HTMLInputElement;
            }

            colorPicker.style.top = y + "px";
            colorPicker.style.left = x + "px";
            colorPicker.value = initialValue!;
            let oldValue = colorPicker.value;

            colorPicker.onblur = e => {
                if (oldValue !== colorPicker!.value) {
                    r(colorPicker!.value);
                } else {
                    r(null);
                }
            };

            colorPicker.focus();
            colorPicker.click();
        });
    },
    fileDialog(options?: {
        multiple?: boolean,
        exts?: string[]
    }) {
        const openFile = document.createElement("input");
        openFile.type = "file";
        openFile.accept = options?.exts?.join(",") ?? "";
        openFile.multiple = options?.multiple ?? true;

        return new Promise((r, rj) => {
            openFile.onchange = e => {
                if(openFile.files !== null && openFile.files.length > 0) {
                    r(openFile.files);
                } else {
                    rj();
                }

                openFile.remove();
            };

            openFile.click();
        }) as Promise<FileList>;
    },
    getEnumValues<Enum>(obj: Enum) {
        return Object.values(obj).filter(x => typeof x === "number" && !Number.isNaN(x)) as number[];
    },
    getTime(time: number) {
        let result = "";
        time = Math.trunc(time);

        let mins = Math.trunc(time / 60);

        if (mins >= 60) {
            let hours = Math.trunc(mins / 60);

            result += hours >= 10 ? hours + ":" : "0" + hours + ":";
        }

        result += mins >= 10 ? mins + ":" : "0" + mins + ":";

        let secs = Math.ceil(time - mins * 60);

        return result + (secs >= 10 ? secs : "0" + secs);
    },
    findParentWithTagName<K extends keyof HTMLElementTagNameMap>(from: HTMLElement | null, tag: K): null | HTMLElementTagNameMap[K] {
        if(from === null) {
            return null;
        }

        if(from.tagName.toLowerCase() === tag) {
            return from as HTMLElementTagNameMap[K];
        }

        return utils.findParentWithTagName(from.parentElement, tag);
    },
    getParent(node: HTMLElement, parentEl: HTMLElement): HTMLElement | null {
        const parent = node.parentElement;

        if(parent === null) {
            return null;
        }

        if(parent === parentEl) {
            return node;
        }

        return utils.getParent(parent, parentEl);
    },
    messageBox(body: string, header: string, info?: string) {
        store.dispatch(createModal("MessageBox", {
            body, header, info
        }));
    },
    messageBoxT(key: keyof typeof en["msg"], tOptions?: string | TOptions<StringMap>, info?: string) {
        utils.messageBox(i18n.t("msg:" + key, tOptions), 
            i18n.exists("msgh:" + key) ? i18n.t("msgh:" + key, tOptions) : i18n.t("msgh:default"), info);
    },
    confirm(text: string, header: string, callback: () => Promise<any>, noCallback?: () => void) {
        store.dispatch(createModal("Confirm", {
            text, header, callback, noCallback
        }));
    },
    confirmT(key: keyof typeof en["msg"], tOptions: string | TOptions<StringMap> | undefined, callback: () => Promise<any>, noCallback?: () => void) {
        utils.confirm(i18n.t("msg:" + key, tOptions), 
            i18n.exists("msgh:" + key) ? i18n.t("msgh:" + key, tOptions) : i18n.t("msgh:default_confirm"), callback, noCallback);
    },
    formatTrack(t: Track) {
        return t.artist + " - " + t.title;
    },
    grabDefaultStyles() {
        const dt: UserTheme = {
            colors: {},
            id: nanoid(),
            name: "Default",
            vars: {}
        };

        for(let i = 0; i < document.styleSheets.length; i++) {
            try {
                const rules = document.styleSheets[i].rules || document.styleSheets[i].cssRules;

                for(let j = 0; j < rules.length; j++) {
                    if(rules[j].type === CSSRule.STYLE_RULE) {
                        const rule = rules[j] as CSSStyleRule;
                        
                        if(rule.selectorText === ":root") {
                            for(let k = 0; k < rule.style.length; k++) {
                                dt.colors[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]).trim();
                            }

                            if(Object.keys(dt.vars).length > 0) {
                                return dt;
                            }
                        } else if(rule.selectorText === ":root:not(.colors)") {
                            for(let k = 0; k < rule.style.length; k++) {
                                dt.vars[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]).trim();
                            }

                            if(Object.keys(dt.colors).length > 0) {
                                return dt;
                            }
                        }
                    }
                }
            } catch {
                continue;
            }
        }

        return dt;
    },
    buildThemeVars(theme: UserTheme) {
        let result = Object.keys(theme.colors).map(c => `${c}:${theme.colors[c]};`).join("");
        result += Object.keys(theme.vars).map(v => `${v}:${theme.vars[v]};`).join("");
        return result;
    },
    buildTheme(theme: UserTheme) {
        const rules = document.writeableSheet.rules || document.writeableSheet.cssRules;
        for(let i = 0; i < rules.length; i++) {
            const rule = rules[i] as CSSStyleRule;

            if(rule.selectorText === `body[theme="${theme.id}"]`) {
                document.writeableSheet.removeRule(i);
                break;
            }
        }

        document.writeableSheet.addRule(`body[theme="${theme.id}"]`, utils.buildThemeVars(theme));
    },
    buildThemeFromId(id: string) {
        const state = store.getState();

        if(state.user.themes[id]) {
            utils.buildTheme(state.user.themes[id]);
        }
    },
    deleteTheme(id: string) {
        const rules = document.writeableSheet.rules || document.writeableSheet.cssRules;
        for(let i = 0; i < rules.length; i++) {
            const rule = rules[i] as CSSStyleRule;

            if(rule.selectorText === `body[theme="${id}"]`) {
                document.writeableSheet.deleteRule(i);
                return;
            }
        }
    },
    setFavicon(url: string) {
        if(favicon === null) {
            favicon = document.querySelector('link[rel="icon"]');

            if(favicon === null) {
                favicon = document.createElement("link");
                favicon.rel = "icon";

                document.head.appendChild(favicon);
            }
        }

        favicon.href = url;
    },
    shuffle(array: any[]) {
        const arr = [...array];

        for(let i = arr.length - 1; i >= 0; i--) {
            const rndIndex = Math.floor(Math.random() * arr.length);
            const tmp = arr[i];
            arr[i] = arr[rndIndex];
            arr[rndIndex] = tmp;
        }

        return arr;
    }
};

export default utils;

export class ClassConditioner {
    private conds: ClassCondition;
    private node?: React.RefObject<HTMLElement>;

    constructor(conds: ClassCondition, node?: React.RefObject<HTMLElement>) {
        this.conds = conds;
        this.node = node;
    }

    get computed() {
        return Object.keys(this.conds)
            .filter(c => typeof this.conds[c] === "function" ? (this.conds[c] as (() => boolean))() : this.conds[c])
            .join(" ");
    }

    append(conds: ClassCondition) {
        this.conds = {...this.conds, ...conds};
        this.update();
    }

    remove(keys: string[]) {
        keys.map(k => delete this.conds[k]);
        this.update();
    }

    update() {
        if(!this.node || !this.node.current) {
            console.warn("Cannot update node classes. Node ref must be defined and used with current property!");
            return;
        }

        this.node.current.className = this.computed;
    }
}

class EventBus extends EventTarget {
    on(event: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        this.addEventListener(event, listener, options);
    }

    emit<T = any>(event: string, init?: CustomEventInit<T>) {
        this.dispatchEvent(new CustomEvent(event, init));
    }

    unsub(event: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
        this.removeEventListener(event, listener, options);
    }
}

export const eventBus = new EventBus();
