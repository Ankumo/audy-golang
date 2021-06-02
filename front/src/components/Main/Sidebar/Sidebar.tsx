import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PlaylistApi, UserApi } from "../../../lib/api";
import { UploadTabs, UserActions } from "../../../lib/enums";
import { Playlist } from "../../../lib/types";
import utils from "../../../lib/utils";
import { selector, useAppDispatch, useDummy } from "../../../store/hooks";
import { playlistsActions } from "../../../store/reducers/playlists";
import { createModal, rootActions } from "../../../store/reducers/root";
import { uploadActions } from "../../../store/reducers/upload";
import Dropdown from "../../Forms/Dropdown";

interface SidebarProps {

}

function Sidebar(props: SidebarProps) {
    const isAdmin = selector(state => state.user.is_admin);
    const nickname = selector(state => state.user.nickname);
    const dummy = useDummy();
    const tracksDragging = selector(state => state.tracks.dragging);

    const playlists = selector(state => {
        const pls = Object.values(state.playlists.list).filter(pl => pl.id !== -1).sort((a, b) => 
            a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
        
        pls.splice(0, 0, state.playlists.list[-1]);
        return pls;
    });

    const apk = selector(state => state.playlists.apk);
    const selectMode = selector(state => state.root.selectMode);
    const currentPlaylist = selector(state => state.playlists.current);
    const lib = selector(state => state.tracks.lib);

    const dispatch = useAppDispatch();
    const {t} = useTranslation();

    const plcl = useCallback((pl: Playlist) => {
        let result: string[] = [];

        if(pl.id === currentPlaylist) {
            result.push("active");
        }

        if(pl.id === -1) {
            result.push("lib");
        }

        return result.join(" ");
    }, [currentPlaylist]);

    function handleUserActions(action: number | string) {
        switch(action) {
            case UserActions.ADD_PLAYLIST:
                PlaylistApi.add(t("new_playlist_name"), []).then(id => {
                    if(!id) {
                        return;
                    }

                    dispatch(playlistsActions.addPlaylist({
                        dbId: id,
                        id,
                        tracks: [],
                        name: t("new_playlist_name")
                    }));

                    dispatch(playlistsActions.setCurrent(id));
                });
                break;
            case UserActions.UPLOAD:
                dispatch(uploadActions.setTab(UploadTabs.MAIN));
                dispatch(createModal("Upload", {}));
                break;
            case UserActions.SETTINGS:
                dispatch(rootActions.setSettingsOpened(true));
                break;
            case UserActions.LOGOUT:
                utils.confirmT("confirm_logout", {}, () => {
                    return UserApi.logout().then(() => {
                        window.location.reload();
                    }).catch(() => {});
                });
                break;
        }
    }

    function handlePlaylistSelect(pl: Playlist) {
        if(selectMode) {
            dispatch(rootActions.setSelectMode());
        }

        dispatch(playlistsActions.setCurrent(pl.id));
    }

    function handleDrop(e: React.MouseEvent<HTMLElement>, pl: Playlist) {
        if(e.button !== 0 || pl.id === -1 || pl.id === currentPlaylist || tracksDragging.length === 0) {
            return;
        }

        const tracks = [...tracksDragging.filter(t => !pl.tracks.includes(t)),...pl.tracks];
        const diff = tracks.length - pl.tracks.length;

        if(diff === 0) {
            utils.alertWarn(t("no_new_tracks_added"));
            return;
        }

        const droppedPl = pl;
        PlaylistApi.update(pl.dbId, tracks).then(() => {
            dispatch(playlistsActions.updateTracks({
                id: droppedPl.id, 
                tracks
            }));

            if(diff > 1) {
                utils.alertInfo(t("playlist_tracks_added", {count: diff, plName: droppedPl.name}));
            } else {
                const addedTrack = lib[tracks[0]];
                utils.alertInfo(t("playlist_track_added", {trackName: utils.formatTrack(addedTrack), plName: droppedPl.name}))
            }
        });
    }

    return (
        <div className="sidebar">
            <Dropdown 
                tns="userActions" 
                naked 
                noScroll 
                items={[
                    {
                        icon: "upload",
                        cond: isAdmin,
                        value: UserActions.UPLOAD
                    },
                    {
                        icon: "addpl",
                        value: UserActions.ADD_PLAYLIST
                    },
                    {
                        icon: "settings",
                        value: UserActions.SETTINGS
                    },
                    {divider: true},
                    {
                        icon: "logout",
                        value: UserActions.LOGOUT
                    }
                ]} 
                onAction={handleUserActions}
            >
                <img src={process.env.REACT_APP_PROXY + "api/avatar?dummy=" + dummy} alt="user_avatar" draggable={false} />
                <span>{nickname}</span>
            </Dropdown>

            <div className="scroll-view">
                <ul className={tracksDragging.length > 0 ? "playlists dragging" : "playlists"}>
                    {playlists.map(pl => (
                        <li key={pl.dbId} 
                            className={plcl(pl)}
                            onMouseUp={e => handleDrop(e, pl)}
                            onClick={() => handlePlaylistSelect(pl)} 
                        >
                            {pl.name === apk ? t("all_tracks_playlist_name") : pl.name}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default Sidebar;