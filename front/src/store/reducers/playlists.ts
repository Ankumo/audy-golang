import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { NumberMapObject, Playlist, Track } from "../../lib/types";

export type PlaylistsState = {
    list: NumberMapObject<Playlist>,
    apk: string,
    libId: number,
    current: number,
    playbacked: number
}

const initialState: PlaylistsState = {
    apk: "",
    current: -1,
    libId: -1,
    playbacked: -1,
    list: {}
};

const playlists = createSlice({
    name: "playlists",
    initialState,
    reducers: {
        setApk(state, action: PayloadAction<string>) {
            state.apk = action.payload;
        },
        setCurrent(state, action: PayloadAction<number>) {
            state.current = action.payload;
        },
        setPlaybacked(state, action: PayloadAction<number>) {
            state.playbacked = action.payload;
        },
        setLibId(state, action: PayloadAction<number>) {
            if(state.list[-1]) {
                state.list[-1].dbId = action.payload;
            }

            state.libId = action.payload;
        },
        setList(state, action: PayloadAction<NumberMapObject<Playlist>>) {
            state.list = action.payload;
        },
        swapTracks(state, action: PayloadAction<{track1: string, track2: string}>) {
            const tracks = currentPlaylist(state).tracks as string[];

            let index1 = tracks.indexOf(action.payload.track1);
            let index2 = tracks.indexOf(action.payload.track2);

            if(~index1 && ~index2 && action.payload.track1 !== action.payload.track2) {
                tracks[index1] = action.payload.track2;
                tracks.splice(index2, 1, action.payload.track1);
            }
        },
        addPlaylist(state, action: PayloadAction<Playlist>) {
            state.list[action.payload.id] = action.payload;
        },
        renamePlaylist(state, action: PayloadAction<{id: number, newName: string}>) {
            if(state.list[action.payload.id]) {
                state.list[action.payload.id].name = action.payload.newName;
            }
        },
        removePlaylist(state, action: PayloadAction<number>) {
            if(state.list[action.payload]) {
                if(state.current === action.payload) {
                    state.current = -1;
                }

                delete state.list[action.payload];
            }
        },
        updateTracks(state, action: PayloadAction<{id: number, tracks: string[]}>) {
            if(state.list[action.payload.id]) {
                state.list[action.payload.id].tracks = action.payload.tracks;
            }
        },
        upload(state, action: PayloadAction<Track>) {
            state.list[-1].tracks.splice(0, 0, action.payload.md5);
        },
        removeTracks(state, action: PayloadAction<string[]>) {
            for(let k in state.list) {
                state.list[k].tracks = state.list[k].tracks.filter(t => !action.payload.includes(t));
            }
        }
    }
});

export default playlists.reducer;
export const playlistsActions = playlists.actions;

export const currentPlaylist = (state: PlaylistsState) => state.list[state.current] ? state.list[state.current] : state.list[-1];