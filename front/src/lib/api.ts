import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Playlist, StringMapObject, UploadFile, UserTheme, ServerData, AppLanguages, TKey, UserInTable } from './types';
import utils from '../lib/utils';

type RequestParams = FormData | StringMapObject<string | File | boolean | number | any[] | Blob>
type DefaultResponse<D = any> = {
    data: D,
    success: boolean,
    key: TKey<"error">,
    error: string
}

export class ApiError extends Error {
    key: TKey<"error">;

    constructor(key: TKey<"error">, message?: string) {
        super();

        this.key = key;
        this.message = message ?? "";
    }

    alert() {
        utils.alertError(this.key, this.message);
    }
}

const Api = {
    req<T = undefined>(apiPart: string, params?: RequestParams, options?: AxiosRequestConfig) {
        return axios.post<any, AxiosResponse<DefaultResponse<T>>>("/api/" + apiPart, Api.wrapParams(params), options).then(res => {
            if(res.status === 200) {
                if(res.data.success) {
                    return res.data.data;
                } else {
                    throw new ApiError(res.data.key, res.data.error);
                }
            } else {
                throw new ApiError("http", res.statusText);
            }
        });
    },

    alertedReq<D = undefined>(apiPart: string, params?: RequestParams, options?: AxiosRequestConfig) {
        return new Promise<D>((r, rj) => {
            Api.req<D>(apiPart, params, options).then(data => {
                r(data);
            }).catch((err: ApiError) => {
                err.alert();
                rj(err);
            });
        });
    },

    wrapParams(params?: RequestParams) {
        if(params) {
            if(!(params instanceof FormData)) {
                const fd = new FormData();

                for(let k in params) {
                    if(Array.isArray(params[k]) || typeof(params[k]) === "object") {
                        if(params[k] instanceof Blob) {
                            fd.append(k, params[k] as Blob, k);
                        } else if(params[k] instanceof File) {
                            fd.append(k, params[k] as File, (params[k] as File).name);
                        } else {
                            for(let i = 0; i < (params[k] as any[]).length; i++) {
                                fd.append(k+"[]", (params[k] as any[])[i]);
                            }
                        }
                    } else {
                        fd.append(k, params[k].toString());
                    }
                }

                params = fd;
            }
        }

        return params;
    },

    serverData() {
        return Api.alertedReq<ServerData>("getserverdata");
    },

    setServerData(default_language: AppLanguages, session_time: number, custom_app_title: string) {
        return Api.alertedReq("setserverdata", {
            default_language, session_time, custom_app_title
        });
    },

    closech() {
        return Api.alertedReq("closech");
    }
};

export default Api;

export const UserApi = {
    add(login: string, password: string, is_admin: boolean) {
        return Api.alertedReq<UserInTable>("adduser", {
            login, password, is_admin
        });
    },

    update(lang: string, rem_ip: boolean, autoplay: boolean) {
        return Api.alertedReq("updateuser", {
            lang,
            rem_ip,
            autoplay
        });
    },

    remove(id: number) {
        return Api.alertedReq("removeuser", {
            id
        });
    },

    changePassword(old: string, _new: string) {
        return Api.alertedReq("changepassword", {
            old,
            new: _new
        });
    },

    resetPassword(id: number) {
        return Api.alertedReq<{newPassword: string}>("resetpassword", {
            id
        });
    },

    updateTheme(theme: string) {
        return Api.alertedReq("updatetheme", {
            theme
        });
    },

    updateThemes(list: StringMapObject<UserTheme>) {
        return Api.alertedReq("updatethemes", {
            list: Object.values(list).map(o => JSON.stringify(o))
        });
    },

    changeAvatar(newAvatar: Blob) {
        return Api.alertedReq("changeavatar", {
            newAvatar
        });
    },

    removeAvatar() {
        return Api.alertedReq("removeavatar");
    },

    changeNickname(newNickname: string) {
        return Api.alertedReq("changenickname", {
            newNickname
        });
    },

    setAdmin(id: number, state: boolean) {
        return Api.alertedReq("setadmin", {
            id, state
        });
    },

    login(login: string, password: string) {
        return Api.alertedReq("login", {
            login, password
        });
    },

    logout() {
        return Api.alertedReq("logout");
    }
};

export const PlaylistApi = {
    fetch() {
        return Api.req<Playlist[]>("getplaylists");
    },

    remove(id: number) {
        return Api.alertedReq("removepl", {
            id
        });
    },

    update(id: number, tracks: string[]) {
        const tracksJSON = JSON.stringify(tracks);
        return Api.alertedReq<number>("updatepl", {
            id,
            tracks: tracksJSON
        });
    },

    add(name: string, tracks: string[]) {
        const tracksJSON = JSON.stringify(tracks);
        return Api.alertedReq<number>("addpl", {
            name,
            tracks: tracksJSON
        });
    },

    rename(id: number, name: string) {
        return Api.req("renamepl", {
            id, name
        }); 
    }
};

export const TrackApi = {
    setLyrics(hash: string, lyrics: string) {
        return Api.req("setlyrics", {
            hash,
            lyrics
        });
    },

    remove(hashes: string[]) {
        return Api.req("removetracks", {
            hashes
        });
    },

    update(hash: string, artist: string, title: string) {
        return Api.req("updatetrack", {
            hash,
            artist,
            title
        });
    },

    upload(file: UploadFile, progressCallback?: (progressEvent: ProgressEvent) => void) {
        let fd = new FormData();
        fd.append("track", file.file);

        return Api.req("upload", fd, {
            cancelToken: file.ct?.token,
            onUploadProgress: progressCallback,
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    reqFtpUpload() {
        return Api.alertedReq("ftp_upload");
    }
};
/*
export const VkApi = {
    search(query) {
        return Api.req("vk/search", Api.fd({
            query
        }));
    },

    login(email, pass) {
        return Api.req("vk/login", Api.fd({
            email,
            pass
        }));
    },

    links(ids) {
        return Api.req("vk/links", Api.fd({
            ids
        }));
    },

    enqd(tracks) {
        return Api.req("vk/enqd", Api.fd({
            tracks
        }));
    },

    deqd(tracks) {
        return Api.req("vk/deqd", Api.fd({
            tracks
        }));
    }
};*/