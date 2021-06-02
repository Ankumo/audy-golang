import {UserState} from '../store/reducers/user';
import {store} from '../store';
import {tracksActions} from '../store/reducers/tracks';
import { LoadingState } from './enums';
import {rootActions} from '../store/reducers/root';
import { Playlist, StringMapObject, Track } from './types';
import { playlistsActions } from '../store/reducers/playlists';
import i18n from '../i18n';
import { play, removeTracks, setUser, uploadTrack } from '../store/thunks';
import utils from './utils';
import { uploadActions } from '../store/reducers/upload';

type SSEHandler = (data: any) => void

type SSE = {
    handlers: {[key: string]: SSEHandler},
    stream: EventSource | null,
    close: () => void
    init: () => void
}

type RawPlaylist = Playlist & {
    tracks: string
}

type RawUserState = UserState & {
    themes: string
}

export interface SSEHandlerDataInit {
    playlists: RawPlaylist[],
    u: RawUserState,
    apk: string,
    lib: string,
    custom_app_title: string,
}

export interface SSEHandlerDataTrackLyrics {
    hash: string,
    lyrics: string
}

export interface FTPUFile {
    fileName: string,
    key: string,
    success: boolean
}

export interface SSEHandlerDataTrackUpdate {
    hash: string,
    title: string,
    artist: string
}

const sse: SSE = {
    stream: null,
    close() {
        if(sse.stream != null && sse.stream.readyState !== EventSource.CLOSED) {
            sse.stream.close();
            sse.stream = null;
        }
    },
    init() {
        store.dispatch(rootActions.setAppState(LoadingState.LOADING));
        sse.close();

        sse.stream = new EventSource(process.env.REACT_APP_PROXY + "api/init", {
            withCredentials: process.env.NODE_ENV === "development"
        });

        sse.stream.addEventListener("error", e => {
            const state = store.getState();
            if(state.root.appState !== LoadingState.ALREADY_CONNECTED) {
                store.dispatch(rootActions.setAppState(LoadingState.ERROR));
            }

            if(window.player.readyState >= 2 && !window.player.paused) {
                window.player.pause();
                store.dispatch(play(null));
            }

            sse.close();
        });

        sse.stream.addEventListener("message", e => {
            let json: {
                type: string | "error",
                data: any
            };

            try {
                json = JSON.parse(e.data);
            } catch {
                console.warn("[SSE] Received invalid response from SSE");
                console.log(e.data);
                return;
            }

            switch(json.type) {
                case "error":
                    switch (json.data.key) {
                        case "already_connected":
                            store.dispatch(rootActions.setAppState(LoadingState.ALREADY_CONNECTED));
                            return;
                    }

                    console.error("[SSE] Error: " + json.data.desc); 
                    console.log(json);
                    store.dispatch(rootActions.setAppState(LoadingState.ERROR));
                    break;
                default:
                    if (sse.handlers[json.type]) {
                        sse.handlers[json.type](json.data);
                    } else {
                        console.warn("[SSE] Handler func for type '" + json.type + "' was not found");
                        console.log(json);
                        console.log(sse.handlers);
                    }
                    break;
            }
        });
    },
    handlers: {
        init(data: SSEHandlerDataInit) {
            store.dispatch(playlistsActions.setApk(data.apk));

            const lib: StringMapObject<Track> = JSON.parse(data.lib);
            store.dispatch(tracksActions.setLib(lib));

            const playlists: StringMapObject<Playlist> = {};

            let libraryPlaylistFound = false;

            for(let i = 0; i < data.playlists.length; i++) {
                const rawpl = data.playlists[i];
                const pl: Playlist = {
                    dbId: rawpl.dbId,
                    tracks: [],
                    id: rawpl.id,
                    name: rawpl.name
                };

                try {
                    pl.tracks = JSON.parse(rawpl.tracks);
                } catch {
                    console.warn("Playlist " + pl.name + " tracks json parsing error. We need to clear it's tracks now :(");
                }

                pl.tracks = pl.tracks.filter(t => lib[t]);
                pl.dbId = pl.id;

                if(pl.name === data.apk) {
                    libraryPlaylistFound = true;

                    store.dispatch(playlistsActions.setLibId(pl.id));
                    const notExists = Object.keys(lib).filter(t => pl.tracks.indexOf(t) < 0);

                    for(let i = 0; i < notExists.length; i++) {
                        pl.tracks.splice(0, 0, notExists[i]);
                    }

                    pl.id = -1;
                }

                playlists[pl.id] = pl;
            }

            if(!libraryPlaylistFound) {
                const sortedLib = Object.values(lib).sort((a, b) => a.timestamp >= b.timestamp ? -1 : 1);

                playlists[-1] = {
                    name: data.apk,
                    id: -1,
                    dbId: -1,
                    tracks: sortedLib.map(t => t.md5)
                }
            }

            const u: UserState = {...data.u, themes: {}};

            try {
                u.themes = JSON.parse(data.u.themes);
            } catch(err) {
                console.warn("Unable to read user theme data. JSON parsing error: " + err);
            }

            for(let k in u.themes) {
                utils.buildTheme(u.themes[k]);
            }

            store.dispatch(setUser(u));
            store.dispatch(playlistsActions.setList(playlists));

            if(i18n.language !== data.u.lang) {
                i18n.changeLanguage(data.u.lang);
            }
            
            const lastSrc = window.localStorage.getItem("lastSrc");

            if(lastSrc && lib[lastSrc]) {
                store.dispatch(play(lastSrc, data.u.autoplay));
            }

            let reservedPlaylist = -1;
            let reservedPlayback: string[] = [];

            const lastPlaylist = parseInt(window.localStorage.getItem("lastPlaylist") as string);

            if(!Number.isNaN(lastPlaylist) && playlists[lastPlaylist]) {
                reservedPlaylist = lastPlaylist;
                reservedPlayback = playlists[lastPlaylist].tracks as string[];
            }

            const lastPlaybackUnparsed = window.localStorage.getItem("lastPlayback");

            if(lastPlaybackUnparsed) {
                reservedPlayback = lastPlaybackUnparsed.split(",");
            }

            store.dispatch(tracksActions.setPlayback(reservedPlayback));
            store.dispatch(playlistsActions.setCurrent(reservedPlaylist));
            store.dispatch(playlistsActions.setPlaybacked(reservedPlaylist));
            
            store.dispatch(rootActions.init(data));
        },
        track_add(data: {track: Track}) {
            store.dispatch(uploadTrack(data.track));
        },
        tracks_remove(data: {hashes: string[]}) {
            store.dispatch(removeTracks(data.hashes));
        },
        track_update(data: SSEHandlerDataTrackUpdate) {
            store.dispatch(tracksActions.updateTrack(data));
        },
        track_lyrics(data: SSEHandlerDataTrackLyrics) {
            store.dispatch(tracksActions.updateLyrics(data));
        },
        ftpu_start(data: {files: number}) {
            if(data.files > 0) {
                store.dispatch(uploadActions.setFtpUploadState(true));
            } else {
                utils.alertError("ftp_upload_no_valid_files");
            }
        },
        ftpu_file_processed(data: FTPUFile) {
            store.dispatch(uploadActions.appendFtpProcessingList(data));
        },
        ftpu_done() {
            store.dispatch(uploadActions.setFtpUploadState(false));
        },
        destroy() {
            store.dispatch(rootActions.setAppState(LoadingState.DESTROYED));
            window.player.pause();
            window.player.src = "";
            sse.close();
            document.title = i18n.t("destroyed_tab_title");
        }
    }
};

export default sse;