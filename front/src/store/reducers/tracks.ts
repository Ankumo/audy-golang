import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppState } from "..";
import { TracksRepeat, TracksSort } from "../../lib/enums"
import { SSEHandlerDataTrackLyrics, SSEHandlerDataTrackUpdate } from "../../lib/sse";
import { StringMapObject, Track } from "../../lib/types";
import utils from "../../lib/utils";
import { currentPlaylist } from "./playlists";

export type TracksState = {
    src: null | Track,
    sort: TracksSort,
    dragging: string[],
    selected: string[],
    lib: StringMapObject<Track>,
    playback: string[],
    repeat: TracksRepeat
}

const initialState: TracksState = {
    dragging: [],
    src: null,
    sort: TracksSort.CUSTOM,
    selected: [],
    lib: {},
    playback: [],
    repeat: TracksRepeat.ALL
};

const tracks = createSlice({
    name: "tracks",
    initialState,
    reducers: {
        setPlayback(state, action: PayloadAction<string[]>) {
            state.playback = action.payload;
            window.localStorage.setItem("lastPlayback", action.payload.join(","));
        },
        setLib(state, action: PayloadAction<StringMapObject<Track>>) {
            state.lib = action.payload;
        },
        select(state, action: PayloadAction<string[]>) {
            state.selected = state.selected.concat(action.payload.filter(x => !state.selected.includes(x)));
        },
        deselect(state, action: PayloadAction<string[]>) {
            state.selected = state.selected.filter(x => !action.payload.includes(x));
        },
        setSelected(state, action: PayloadAction<string[]>) {
            state.selected = action.payload;
        },
        setRepeat(state, action: PayloadAction<TracksRepeat>) {
            state.repeat = action.payload;
        },
        setSort(state, action: PayloadAction<number | TracksSort>) {
            state.sort = action.payload;
        },
        setDragging(state, action: PayloadAction<string[]>) {
            state.dragging = action.payload;
        },
        upload(state, action: PayloadAction<Track>) {
            state.lib[action.payload.md5] = action.payload;
        },
        removeTracks(state, action: PayloadAction<string[]>) {
            for(let i = 0; i < action.payload.length; i++) {
                if(state.lib[action.payload[i]]) {
                    delete state.lib[action.payload[i]];
                }
            }
        },
        updateLyrics(state, action: PayloadAction<SSEHandlerDataTrackLyrics>) {
            if(state.lib[action.payload.hash]) {
                state.lib[action.payload.hash].lyrics = action.payload.lyrics;
            }
        },
        updateTrack(state, action: PayloadAction<SSEHandlerDataTrackUpdate>) {
            if(state.lib[action.payload.hash]) {
                state.lib[action.payload.hash].title = action.payload.title;
                state.lib[action.payload.hash].artist = action.payload.artist;
            }
        },
        setSrc(state, action: PayloadAction<Track | null>) {
            state.src = action.payload;
        }
    }
});

export default tracks.reducer;
export const tracksActions = tracks.actions;

export const filteredTracks = (state: AppState): Track[] => {
    if(state.root.editMode) {
        let tracks = Object.values(state.tracks.lib);

        if(state.root.searchString.length > 0) {
            tracks = tracks.filter(t => ~utils.formatTrack(t).toLowerCase().indexOf(state.root.searchString.toLowerCase()));
        }

        return tracks;
    }

    const plTracks = currentPlaylist(state.playlists).tracks as string[];
    let tracks: Track[] = plTracks.filter(t => state.tracks.lib[t]).map(t => state.tracks.lib[t]);

    if(state.root.searchString.length > 0) {
        tracks = tracks.filter(t => ~utils.formatTrack(t).toLowerCase().indexOf(state.root.searchString.toLowerCase()));
    }

    switch (state.tracks.sort) {
        case TracksSort.TIMESTAMP_ASC:
            tracks.sort((a, b) => {
                return a.timestamp >= b.timestamp ? 1 : -1;
            });
            break;
        case TracksSort.TIMESTAMP_DESC:
            tracks.sort((a, b) => {
                return a.timestamp >= b.timestamp ? -1 : 1;
            });
            break;
        case TracksSort.ARTIST_ASC:
            tracks.sort((a, b) => {
                return a.artist.toLowerCase() >= b.artist.toLowerCase() ? 1 : -1;
            });
            break;
        case TracksSort.ARTIST_DESC:
            tracks.sort((a, b) => {
                return a.artist.toLowerCase() >= b.artist.toLowerCase() ? -1 : 1;
            });
            break;
        case TracksSort.TITLE_ASC:
            tracks.sort((a, b) => {
                return a.title.toLowerCase() >= b.title.toLowerCase() ? 1 : -1;
            });
            break;
        case TracksSort.TITLE_DESC:
            tracks.sort((a, b) => {
                return a.title.toLowerCase() >= b.title.toLowerCase() ? -1 : 1;
            });
            break;
        case TracksSort.DURATION_ASC:
            tracks.sort((a, b) => {
                return a.duration >= b.duration ? 1 : -1;
            });
            break;
        case TracksSort.DURATION_DESC:
            tracks.sort((a, b) => {
                return a.duration >= b.duration ? -1 : 1;
            });
            break;
    }

    return tracks;
};