import { AppThunk, store } from ".";
import i18n from "../i18n";
import { ApiError, TrackApi } from "../lib/api";
import { FileState, TracksRepeat } from "../lib/enums";
import { Track, UploadFile } from "../lib/types";
import utils from "../lib/utils";
import { playlistsActions } from "./reducers/playlists";
import { rootActions } from "./reducers/root";
import { tracksActions } from "./reducers/tracks";
import { uploadActions } from "./reducers/upload";
import { userActions, UserState } from "./reducers/user";

export const removeTracks = (hashes: string[]): AppThunk => dispatch => {
    const state = store.getState();

    dispatch(tracksActions.removeTracks(hashes));
    dispatch(tracksActions.deselect(hashes));
    dispatch(playlistsActions.removeTracks(hashes));

    const newPlayback = state.tracks.playback.filter(t => !hashes.includes(t));
    dispatch(tracksActions.setPlayback(newPlayback));

    if(state.tracks.src && hashes.includes(state.tracks.src.md5)) {
        if(state.tracks.repeat === TracksRepeat.ONE || newPlayback.length === 0) {
            dispatch(play(null));
            return;
        }

        let index = state.tracks.playback.findIndex(t => t === state.tracks.src!.md5);
        if(~index++) {
            for(; index < state.tracks.playback.length; index++) {
                if(!hashes.includes(state.tracks.playback[index])) {
                    break;
                }
            }

            if(index >= state.tracks.playback.length) {
                index = 0;
            }

            dispatch(play(state.tracks.playback[index], !window.player.paused));
        }
    }
}

export const uploadTrack = (track: Track): AppThunk => dispatch => {
    dispatch(tracksActions.upload(track));
    dispatch(playlistsActions.upload(track));
}

export const queueNextHttp = (): AppThunk => dispatch => {
    const state = store.getState();
    let nextFile: UploadFile | null = null;

    for(const f of state.upload.queue) {
        if(f.state === FileState.QUEUE) {
            nextFile = f;
            break;
        }
    }
    
    dispatch(uploadActions.setCurrentFile(nextFile?.id ?? ""));

    if(nextFile === null) {
        return;
    }

    dispatch(uploadActions.setLoadedCurrent(0));
    TrackApi.upload(nextFile, progress => {
        dispatch(uploadActions.setLoadedCurrent(progress.loaded));
    }).then(() => {
        dispatch(uploadActions.setCurrentFileDone());
        dispatch(queueNextHttp());
    }).catch((err: ApiError) => {
        dispatch(uploadActions.setCurrentFileError(err));
        dispatch(queueNextHttp());
    });
}   

export const dequeueHttp = (fileId: string): AppThunk => dispatch => {
    const state = store.getState();

    for(let i = 0; i < state.upload.queue.length; i++) {
        const f = state.upload.queue[i];

        if(f.id === fileId) {
            dispatch(uploadActions.queueRemove(i));

            if(f.state === FileState.ACTIVE && f.ct) {
                f.ct.cancel();
                dispatch(queueNextHttp());
            }
            return;
        }
    }
}

export const startHttp = (files: UploadFile[]): AppThunk => dispatch => {
    const state = store.getState();
    const fileIds = state.upload.queue.map(f => f.id);
    const queued = state.upload.queue.filter(f => f.state === FileState.QUEUE || f.state === FileState.ACTIVE);
    let uploadId = state.upload.uploadId;

    if(queued.length === 0) {
        dispatch(uploadActions.newUploadId());
        uploadId++;
    }

    let filesAppended = 0;
    for(const f of files) {
        if(fileIds.includes(f.id)) {
            continue;
        }

        f.uploadId = uploadId;
        dispatch(uploadActions.queueAdd(f));
        filesAppended++;
    }

    if(state.upload.currentFile.length === 0 && state.upload.queue.length + filesAppended > 0) {
        dispatch(queueNextHttp());
    }
}

export const startFtp = (pendingFiles: number): AppThunk => dispatch => {
    dispatch(uploadActions.setFtpUploadState(true));
    dispatch(uploadActions.setFtpUploadPendingFiles(pendingFiles));
    dispatch(uploadActions.clearFtpProcessingList());
}

export const setUser = (user: UserState): AppThunk => dispatch => {
    dispatch(userActions.setUserData(user));
    dispatch(userActions.setThemeList(user.themes));
    dispatch(userActions.setTheme(user.theme));
    dispatch(userActions.updateNickname(user.nickname));
    dispatch(userActions.updatePrefs(user));
}

export const play = (src: string | null, resumePlayer: boolean = false): AppThunk => dispatch => {
    const state = store.getState();

    if(src === null) {
        if(state.tracks.src === null) {
            return;
        }

        window.player.src = "";
        document.title = state.root.appTitle;
        window.localStorage.removeItem("last");

        if(navigator.mediaSession) {
            navigator.mediaSession.metadata = null;
        }

        dispatch(rootActions.setBgUrl());
        dispatch(tracksActions.setSrc(null));

        return;
    }

    const track = state.tracks.lib[src];
    if(!track) {
        return;
    }

    window.player.src = utils.proxy("music/" + track.md5);
    window.localStorage.setItem("lastSrc", track.md5);

    if(navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: i18n.t("default_title")
        });
    }

    if(track.has_image) {
        dispatch(rootActions.setBgUrl(utils.apiProxy("albumimage", "/" + track.md5)));
    } else {
        dispatch(rootActions.setBgUrl());
    }

    if(resumePlayer) {
        window.player.play();
        document.title = utils.formatTrack(track);
    }
    
    dispatch(tracksActions.setSrc(track));
}
