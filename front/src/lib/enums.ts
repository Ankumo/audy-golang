export enum LoadingState {
    LOADING,
    READY,
    ALREADY_CONNECTED,
    ERROR,
    DESTROYED
}

export enum TracksSort {
    CUSTOM,
    TIMESTAMP_ASC,
    TIMESTAMP_DESC,
    ARTIST_ASC,
    ARTIST_DESC,
    TITLE_ASC,
    TITLE_DESC,
    DURATION_ASC,
    DURATION_DESC
}

export enum FileState {
    DONE,
    QUEUE,
    ACTIVE,
    ERROR
}

export enum TracksRepeat {
    ALL,
    ONE,
    SHUFFLE
}

export enum UserActions {
    UPLOAD,
    ADD_PLAYLIST,
    SETTINGS,
    LOGOUT
}

export enum PlaylistActions {
    EDIT,
    SELECT,
    DELETE
}

export enum TracklistItemActions {
    EDIT,
    SHOW_LYRICS,
    DOWNLOAD,
    DELETE,
    DELETE_FROM_LIB
}

export enum UploadTabs {
    MAIN,
    // VK_LOGIN,
    // VK_SEARCH,
    UPLOAD_HTTP,
    UPLOAD_FTP
}

export enum SettingsTabs {
    ACCOUNT,
    THEMES,
    ADMIN,
    VK
}

export enum UserTableActions {
    RESET_PASSWORD,
    DELETE,
    SET_ADMIN,
    UNSET_ADMIN
}