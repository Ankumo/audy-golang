import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { StringMapObject, UserTheme } from "../../lib/types";

export type UserState = {
    theme: string,
    themes: StringMapObject<UserTheme>
    nickname: string,
    id: number,
    lang: string,
    is_admin: boolean,
    rem_ip: boolean,
    autoplay: boolean,
    has_avatar: boolean,
    is_root: boolean
}

const initialState: UserState = {
    autoplay: false,
    id: -1,
    is_admin: false,
    nickname: "",
    rem_ip: false,
    theme: "",
    lang: "en",
    themes: {},
    has_avatar: false,
    is_root: false
};

const user = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUserData(state, action: PayloadAction<{id: number, is_admin: boolean, is_root: boolean}>) {
            state.id = action.payload.id;
            state.is_admin = action.payload.is_admin;
            state.is_root = action.payload.is_root;
        },
        updateNickname(state, action: PayloadAction<string>) {
            state.nickname = action.payload;
        },
        updatePrefs(state, action: PayloadAction<{autoplay: boolean, rem_ip: boolean, lang: string}>) {
            state.rem_ip = action.payload.rem_ip;
            state.autoplay = action.payload.autoplay;
            state.lang = action.payload.lang;
        },
        setTheme(state, action: PayloadAction<string>) {
            state.theme = action.payload;
            document.body.setAttribute("theme", state.theme);
        },
        setThemeList(state, action: PayloadAction<StringMapObject<UserTheme>>) {
            state.themes = action.payload;
        },
        setHasAvatar(state, action: PayloadAction<boolean>) {
            state.has_avatar = action.payload;
        }
    }
})

export default user.reducer;
export const userActions = user.actions;