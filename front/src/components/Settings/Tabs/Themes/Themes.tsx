import { nanoid } from "@reduxjs/toolkit";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserApi } from "../../../../lib/api";
import { useComponentDidMount } from "../../../../lib/hooks";
import { StringMapObject, UserTheme } from "../../../../lib/types";
import utils from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { userActions } from "../../../../store/reducers/user";
import Button from "../../../Forms/Button";
import ColorInput from "../../../Forms/ColorInput";
import EditableHeader from "../../../Forms/EditableHeader";
import Input from "../../../Forms/Input";
import Select from "../../../Forms/Select";
import KeyTransition from "../../../Helpers/KeyTransition";
import SettingsBlock from "../../SettingsBlock";

interface ThemesProps {

}

function getThemeVars(theme: UserTheme) {
    let obj: StringMapObject<string> = {};

    if(theme.id === document.defaultTheme.id) {
        obj = {...document.defaultTheme.colors, ...document.defaultTheme.vars};
    } else {
        Object.keys(document.defaultTheme.colors).forEach(c => obj[c] = theme.colors[c] ? theme.colors[c] : document.defaultTheme.colors[c]);
        Object.keys(document.defaultTheme.vars).forEach(v => obj[v] = theme.vars[v] ? theme.vars[v] : document.defaultTheme.vars[v]);
    }

    return obj;
}

function Themes(props: ThemesProps) {
    const themes = selector(state => state.user.themes);
    const currentTheme = selector(state => state.user.theme);

    const [choosen, setChoosen] = useState(themes[currentTheme] ? themes[currentTheme] : document.defaultTheme);
    const [themesState, setThemesState] = useState(themes);
    const [themeName, setThemeName] = useState(choosen.name);
    const [themeSelectLoading, setThemeSelectLoading] = useState(false);
    const [themeVars, setThemeVars] = useState(getThemeVars(choosen));

    const {t, i18n} = useTranslation();
    const dispatch = useAppDispatch();

    const chooseTheme = useCallback((theme: UserTheme) => {
        setThemeVars(getThemeVars(theme));
        setThemeName(theme.id === document.defaultTheme.id ? t("default_theme_name") : theme.name);
        setChoosen(theme);
    }, [setChoosen, setThemeName, setThemeVars, t]);

    const setThemeInputValue = useCallback((k: string, val: string) => {
        setThemeVars({...themeVars, [k]: val});
    }, [setThemeVars, themeVars]);

    const handleThemeSelect = useCallback(async (val: string) => {
        const themeId = themes[val] ? val : "";

        setThemeSelectLoading(true);
        await UserApi.updateTheme(themeId).then(() => {
            dispatch(userActions.setTheme(themeId));

            if(themeId === choosen.id && themesState[themeId]) {
                utils.buildTheme(themesState[themeId]);
            }
        }).catch(() => {});
        setThemeSelectLoading(false);
    }, [themes, dispatch, choosen.id, themesState]);

    const handleAddTheme = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(Object.keys(themes).length >= 20) {
            utils.alertWarn(t("themes_list_limit"));
            return;
        }

        let newTheme: UserTheme = {
            colors: {},
            id: nanoid(),
            name: t("new_theme_name"),
            vars: {}
        };

        let choosenTheme = themesState[choosen.id];

        if(choosenTheme) {
            newTheme = {
                colors: {...choosenTheme.colors},
                id: nanoid(),
                name: t("new_theme_name"),
                vars: {...choosenTheme.vars}
            }
        }

        setThemesState({...themesState, [newTheme.id]: newTheme});
        chooseTheme(newTheme);
    }, [t, themesState, choosen, themes, chooseTheme]);

    const handleChooseTheme = useCallback((e: React.MouseEvent<HTMLElement>, theme: UserTheme) => {
        if(e.button !== 0 || choosen.id === theme.id) {
            return;
        }

        chooseTheme(theme);
    }, [chooseTheme, choosen.id]);

    const handleDeleteTheme = useCallback((e: React.MouseEvent<HTMLElement>, theme: UserTheme) => {
        if(e.button !== 0) {
            return;
        }

        utils.confirmT("confirm_remove_theme", {tName: theme.name}, async () => {
            const newlist = {...themesState};
            delete newlist[theme.id];

            setThemesState(newlist);
            chooseTheme(document.defaultTheme);
        });

        e.stopPropagation();
    }, [themesState, chooseTheme]);

    const handleThemeNameChange = useCallback((val: string) => {
        if(choosen.id === document.defaultTheme.id) {
            return;
        }

        if(val.length === 0) {
            setThemeName(choosen.name);
            utils.alertWarn(t("theme_name_empty"));
            return;
        }

        setThemesState({...themesState, [choosen.id]: {...choosen, name: val}});
    }, [choosen, themesState, t]);

    const handleSaveThemes = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const list = {...themesState};
        return UserApi.updateThemes(list).then(() => {
            dispatch(userActions.setThemeList(list));
            Object.values(list).forEach(utils.buildTheme);

            if(!list[currentTheme]) {
                dispatch(userActions.setTheme(""));
            }
        }).catch(() => {});
    }, [themesState, dispatch, currentTheme]);

    const handleThemeVarChange = useCallback((k: string, val: string, inVar: boolean = false) => {
        if(choosen.id === document.defaultTheme.id) {
            return;
        }

        let updatedTheme: UserTheme;

        if(inVar) {
            updatedTheme = {...choosen, vars: {...choosen.vars, [k]: val}};
        } else {
            updatedTheme = {...choosen, colors: {...choosen.colors, [k]: val}};
        }
        
        if(currentTheme === choosen.id) {
            utils.buildTheme(updatedTheme);
        }

        setThemesState({...themesState, [choosen.id]: updatedTheme});
    }, [themesState, choosen, currentTheme]);

    const defaultChoosen = choosen.id === document.defaultTheme.id;

    useComponentDidMount(() => {
        return () => {
            utils.buildThemeFromId(currentTheme);
        }
    }); 

    return (
        <div className="themes">
            <SettingsBlock for="set_theme">
                <>
                    <span>
                        {t("set_app_theme_help")}
                    </span>
                    <span className="with-dropdown">
                        {t("current_theme")}:
                        <Select 
                            disabled={themeSelectLoading} 
                            value={currentTheme.length === 0 ? document.defaultTheme.id : currentTheme} 
                            options={[
                                {
                                    value: document.defaultTheme.id,
                                    text: t("default_theme_name")
                                },
                                ...Object.values(themes).map(t => {
                                    return {
                                        value: t.id,
                                        text: t.name
                                    };
                                })
                            ]} 
                            onChange={val => handleThemeSelect(val as string)} 
                        />
                    </span>
                </>
            </SettingsBlock>

            <SettingsBlock for="customize_themes" btnText="save" btnClick={handleSaveThemes}>
                <>
                    <Button 
                        text="add_theme"
                        onClick={handleAddTheme} 
                        accent="primary" 
                        icon="addpl" 
                    />
                    <div className="themes-controls">
                        <ul>
                            <li 
                                className={defaultChoosen ? "active" : ""} 
                                onClick={e => handleChooseTheme(e, document.defaultTheme)}
                            >
                                <span>{t("default_theme_name")}</span>
                            </li>
                            {Object.values(themesState).map(t => (
                                <li 
                                    key={t.id} 
                                    className={t.id === choosen.id ? "active" : ""}
                                    onClick={e => handleChooseTheme(e, t)} 
                                >
                                    <span>{t.name}</span>
                                    <img 
                                        alt="delete_theme_icon" 
                                        src="/img/trash.svg" 
                                        className="svg hover" 
                                        onClick={e => handleDeleteTheme(e, t)} 
                                    />
                                </li>
                            ))}
                        </ul>
                        <KeyTransition tkey={choosen.id}>
                            <div className="colors">
                                <EditableHeader 
                                    placeholder="theme_name"
                                    readonly={defaultChoosen} 
                                    value={themeName} 
                                    maxlength={20} 
                                    onInput={setThemeName} 
                                    onChange={handleThemeNameChange} 
                                />
                                {Object.keys(document.defaultTheme.colors).map(k => (
                                    <ColorInput 
                                        key={k} 
                                        disabled={defaultChoosen}
                                        placeholder={i18n.t("themeKeys:" + k)} 
                                        value={themeVars[k]} 
                                        onInput={val => setThemeInputValue(k, val)} 
                                        onChange={val => handleThemeVarChange(k, val)} 
                                    />
                                ))}
                                <div className="divider"></div>
                                {Object.keys(document.defaultTheme.vars).map(k => (
                                    <Input 
                                        key={k} 
                                        disabled={defaultChoosen}
                                        placeholder={i18n.t("themeKeys:" + k)} 
                                        value={themeVars[k]} 
                                        onInput={val => setThemeInputValue(k, val)} 
                                        onChange={val => handleThemeVarChange(k, val, true)}
                                    />
                                ))}
                            </div>
                        </KeyTransition>
                    </div>
                </>
            </SettingsBlock>
        </div>
    );
}

export default Themes;