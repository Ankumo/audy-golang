import { CancelTokenSource } from "axios";
import React from "react";
import Modals from '../components/Modals';
import langs from "../i18n/locales";
import en from "../i18n/locales/en";
import { ApiError } from "./api";
import { FileState } from "./enums";

export type StringMapObject<Type> = {[key: string]: Type}
export type NumberMapObject<Type> = {[key: number]: Type}

export type ModalBase = {
    id?: string,
    className?: string
}

export type ModalKey = keyof typeof Modals;
export type ForwardRefGeneric<T> = T extends React.ForwardRefExoticComponent<infer X> ? X : never

export type ModalModel = {
    component: ModalKey,
    props: ModalBase
}

export interface UploadFile {
    ct?: CancelTokenSource,
    state: FileState,
    uploadId: number,
    err?: ApiError,
    id: string,
    file: File
}

export type DropdownAction = {
    text?: string,
    cond?: boolean | (() => boolean),
    value?: string | number,
    divider?: boolean,
    icon?: string
}

export type ClassCondition = {[key: string]: boolean | (() => boolean)}

export type Playlist = {
    name: string,
    id: number,
    dbId: number,
    tracks: string[]
}

export type Track = {
    md5: string,
    artist: string,
    title: string,
    duration: number,
    has_image: boolean,
    timestamp: number,
    lyrics: string
}

export type UserTheme = {
    name: string,
    id: string,
    vars: StringMapObject<string>,
    colors: StringMapObject<string>
}

export type UserInTable = {
    nickname: string,
    is_admin: boolean,
    id: number
}

export type ServerData = {
    users: UserInTable[],
    vars: {
        default_language: string,
        session_time: number,
        custom_app_title: string
    },
    fetched: boolean
}

export type TKey<T extends keyof typeof en> = keyof typeof en[T];
export type AppLanguages = keyof typeof langs;

export type WindowState = {
    e: Event,
    innerHeight: number,
    innerWidth: number,
    outerHeight: number,
    outerWidth: number
}