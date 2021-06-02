import { configureStore, ThunkAction, Action, getDefaultMiddleware } from '@reduxjs/toolkit';
import reducer from './reducers';

export const store = configureStore({
    reducer,
    middleware: getDefaultMiddleware({
        serializableCheck: {
            ignoredActions: [
                "root/addModal",
                "root/hideModal",
                "root/addAlert",
                "root/closeAlert",
                "upload/queueAdd",
                "upload/queueRemove",
                "upload/setCurrentFile",
                "upload/setCurrentFileError",
                "upload/setCurrentFileDone",
            ],
            ignoredPaths: [
                "root.modals",
                "root.alerts",
                "upload.queue",
                "upload.currentFile"
            ]
        }
    })
});

export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    AppState,
    unknown,
    Action<string>
>;
