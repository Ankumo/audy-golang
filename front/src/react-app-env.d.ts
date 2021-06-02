/// <reference types="react-scripts" />

declare type MediaSession = {
    metadata: MediaMetadata | null,
    playbackState: "none" | "paused" | "playing",
    setActionHandler: (type: "play" | "pause" | "stop" | "seekbackward" | "seekto" | "skipad" | "previoustrack" | "nexttrack", callback: () => void) => void,
    setPositionState: (stateDict: MediaPositionState) => void
}

declare type MediaImage = {
    src: string,
    sizes: string,
    type: "image/png" | "image/jpeg"
}

declare interface Window {
    player: HTMLAudioElement
}

declare interface Navigator {
    mediaSession: MediaSession
}

declare namespace NodeJS {
    declare interface ProcessEnv {
        REACT_APP_PROXY: string
    }
}

declare type MediaPositionState = {
    duration: number,
    playbackRate: number,
    position: number
}

declare class MediaMetadata {
    title: string;
    artist: string;
    album: string;
    artwork: MediaImage[];

    constructor(obj: {
        title?: string;
        artist?: string;
        album?: string;
        artwork?: MediaImage[];
    })
}

declare interface Document {
    defaultTheme: import("./lib/types").UserTheme,
    writeableSheet: CSSStyleSheet
}

declare interface CSSProperties extends CSS.Properties<string> {

}