import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";
import { AlertProps } from "../../components/Helpers/Alert";
import Modals from "../../components/Modals";
import i18n from "../../i18n";
import { LoadingState } from "../../lib/enums";
import { SSEHandlerDataInit } from "../../lib/sse";
import { ForwardRefGeneric, ModalModel, ServerData, UserInTable } from "../../lib/types";
import utils from "../../lib/utils";

export interface RootState {
    appState: LoadingState,
    selectMode: boolean,
    editMode: boolean,
    settingsOpened: boolean,
    modals: ModalModel[],
    alerts: AlertProps[],
    searchString: string,
    updateDummy: number,
    serverData: ServerData,
    bgUrl: string,
    appTitle: string
}

const initialState: RootState = {
    appState: LoadingState.LOADING,
    selectMode: false,
    editMode: false,
    settingsOpened: false,
    modals: [],
    alerts: [],
    searchString: "",
    updateDummy: Date.now(),
    serverData: {
        users: [],
        vars: {
            custom_app_title: "",
            default_language: "",
            session_time: 0
        },
        fetched: false
    },
    bgUrl: "/img/default_album.png",
    appTitle: i18n.t("default_title")
};

export const root = createSlice({
    name: "root",
    initialState,
    reducers: {
        setAppState(state, action: PayloadAction<LoadingState>) {
            state.appState = action.payload;
        },
        addModal(state, action: PayloadAction<ModalModel>) {
            action.payload.props.id = nanoid();
            
            state.modals.push(action.payload);
        },
        hideModal(state, action: PayloadAction<string | undefined>) {
            if(state.modals.length === 0) {
                return;
            }

            if(!action.payload) {
                state.modals.splice(state.modals.length - 1, 1);
            } else {
                let find = state.modals.find(m => m.props.id === action.payload);

                if(find) {
                    state.modals.splice(state.modals.indexOf(find), 1);
                }
            }
        },
        setSearchString(state, action: PayloadAction<string>) {
            state.searchString = action.payload;
        },
        addAlert(state, action: PayloadAction<AlertProps>) {
            action.payload.id = nanoid();
            state.alerts.push(action.payload);

            if(state.alerts.length > 3) {
                state.alerts.splice(0, 1);
            }
        },
        closeAlert(state, action: PayloadAction<string | undefined>) {
            if(state.alerts.length === 0) {
                return;
            }

            if(!action.payload) {
                state.alerts.splice(state.alerts.length - 1, 1);
            } else {
                let find = state.alerts.find(a => a.id === action.payload);

                if(find) {
                    state.alerts.splice(state.alerts.indexOf(find), 1);
                }
            }
        },
        updateDummies(state) {
            state.updateDummy = Date.now();
        },
        setSelectMode(state, action: PayloadAction<boolean | undefined>) {
            if(action.payload === undefined) {
                state.selectMode = !state.selectMode;
            } else {
                state.selectMode = action.payload;
            }

            if(!state.selectMode && state.editMode) {
                state.editMode = false;
            }
        },
        setEditMode(state, action: PayloadAction<boolean | undefined>) {
            if(action.payload === undefined) {
                state.editMode = !state.editMode;
            } else {
                state.editMode = action.payload;
            }

            state.selectMode = state.editMode;
        },
        setSettingsOpened(state, action: PayloadAction<boolean | undefined>) {
            if(action.payload === undefined) {
                state.settingsOpened = !state.settingsOpened;
            } else {
                state.settingsOpened = action.payload;
            }
        },
        setServerData(state, action: PayloadAction<ServerData>) {
            state.serverData = action.payload;
        },
        appendUser(state, action: PayloadAction<UserInTable>) {
            if(state.serverData.fetched) {
                state.serverData.users.push(action.payload);
            }
        },
        removeUser(state, action: PayloadAction<number>) {
            if(state.serverData.fetched) {
                let index = state.serverData.users.findIndex(u => u.id === action.payload);

                if(index >= 0) {
                    state.serverData.users.splice(index, 1);
                }
            }
        },
        setUserAdmin(state, action: PayloadAction<{id: number, state: boolean}>) {
            if(state.serverData.fetched) {
                const u = state.serverData.users.find(u => u.id === action.payload.id);

                if(u) {
                    u.is_admin = action.payload.state;
                }
            }
        },
        setBgUrl(state, action: PayloadAction<string | undefined>) {
            if(!action.payload) {
                action.payload = "/img/default_album.png";
            }

            if(state.bgUrl !== action.payload) {
                state.bgUrl = action.payload;

                utils.setFavicon(state.bgUrl);

                if(navigator.mediaSession.metadata) {
                    navigator.mediaSession.metadata.artwork = [
                        { src: state.bgUrl, sizes: "512x512", type: 'image/jpeg' }
                    ];
                }
            }
        },
        setAppTitle(state, action: PayloadAction<string>) {
            if(action.payload.length > 0) {
                state.appTitle = action.payload;
            } else {
                state.appTitle = i18n.t("default_title");
            }

            if(window.player.paused) {
                document.title = state.appTitle;
            }
        },
        init(state, action: PayloadAction<SSEHandlerDataInit>) {
            state.appTitle = action.payload.custom_app_title;

            state.appState = LoadingState.READY;
        }
    }
});

export default root.reducer;
export const rootActions = root.actions;

export function createModal<K extends keyof typeof Modals>(component: K, props: ForwardRefGeneric<typeof Modals[K]>) {
    return rootActions.addModal({
        component, props
    });
}