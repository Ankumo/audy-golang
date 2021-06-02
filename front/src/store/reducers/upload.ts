import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ApiError } from "../../lib/api";
import { FileState, UploadTabs } from "../../lib/enums";
import { FTPUFile } from "../../lib/sse";
import { UploadFile } from "../../lib/types";

interface UploadState {
    tab: UploadTabs,
    queue: UploadFile[],
    currentFile: string,
    loadedCurrent: number,
    uploadId: number,
    ftpProcessingList: FTPUFile[],
    ftpUploadActive: boolean,
    ftpUploadPendingFiles: number
}

const initialState: UploadState = {
    tab: UploadTabs.MAIN,
    currentFile: "",
    ftpProcessingList: [],
    queue: [],
    loadedCurrent: 0,
    uploadId: 0,
    ftpUploadActive: false,
    ftpUploadPendingFiles: 0
};

const upload = createSlice({
    name: "upload",
    initialState,
    reducers: {
        setTab(state, action: PayloadAction<UploadTabs>) {
            state.tab = action.payload;
        },
        queueAdd(state, action: PayloadAction<UploadFile>) {
            state.queue.push(action.payload);
        },
        queueRemove(state, action: PayloadAction<number>) {
            if(state.queue.length > action.payload) {
                state.queue.splice(action.payload, 1);
            }
        },
        setLoadedCurrent(state, action: PayloadAction<number>) {
            state.loadedCurrent = action.payload;
        },
        setCurrentFile(state, action: PayloadAction<string>) {
            state.currentFile = action.payload;

            const file = state.queue.find(f => f.id === state.currentFile);

            if(file) {
                file.state = FileState.ACTIVE;
            }
        },
        clearQueue(state) {
            state.queue = state.queue.filter(f => f.state !== FileState.DONE);
        },
        newUploadId(state) {
            state.uploadId++;
        },
        clearFtpProcessingList(state) {
            state.ftpProcessingList = [];
        },
        setFtpUploadState(state, action: PayloadAction<boolean | undefined>) {
            if(action.payload === undefined) {
                state.ftpUploadActive = !state.ftpUploadActive;
            } else {
                state.ftpUploadActive = action.payload;
            }

            if(state.ftpUploadActive) {
                state.ftpProcessingList = [];
            }
        },
        appendFtpProcessingList(state, action: PayloadAction<FTPUFile>) {
            state.ftpProcessingList.push(action.payload);
        },
        setFtpUploadPendingFiles(state, action: PayloadAction<number>) {
            state.ftpUploadPendingFiles = action.payload;
        },
        setCurrentFileDone(state) {
            const file = state.queue.find(f => f.id === state.currentFile);

            if(file) {
                file.state = FileState.DONE;
            }
        },
        setCurrentFileError(state, action: PayloadAction<ApiError>) {
            const file = state.queue.find(f => f.id === state.currentFile);

            if(file) {
                file.state = FileState.ERROR;
                file.err = action.payload;
            }
        }
    }
});

export default upload.reducer;
export const uploadActions = upload.actions;

export const queueLoaded = ({upload}: {upload: UploadState}): number => {
    return upload.queue.reduce<number>((sum, f) => {
        let add = 0;
        if(f.uploadId === upload.uploadId && f.state !== FileState.ACTIVE && f.state !== FileState.QUEUE) {
            add = f.file.size;
        }

        return sum + add;
    }, 0) + upload.loadedCurrent;
}

export const currentSize = ({upload}: {upload: UploadState}): number => {
    const file = upload.queue.find(f => f.id === upload.currentFile);
    return file ? file.file.size : 0;
}

export const queueSize = ({upload}: {upload: UploadState}): number => {
    return upload.queue.reduce<number>((sum, f) => sum + (f.uploadId === upload.uploadId ? f.file.size : 0), 0);
}