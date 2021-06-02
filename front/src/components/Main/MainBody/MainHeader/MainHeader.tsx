import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, PlaylistApi } from "../../../../lib/api";
import { usePrev } from "../../../../lib/hooks";
import utils from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { playlistsActions } from "../../../../store/reducers/playlists";
import EditableHeader from "../../../Forms/EditableHeader";
import KeyTransition from "../../../Helpers/KeyTransition";

interface MainHeaderProps {

}

function MainHeader(props: MainHeaderProps) {
    const currentPl = selector(state => state.playlists.list[state.playlists.current]);
    const [plName, setPlName] = useState(currentPl.name);
    let prevPl = usePrev(currentPl.id);
    const {t} = useTranslation();
    const dispatch = useAppDispatch();

    const handlePlaylistNameChange = useCallback((val: string) => {
        if(val.length === 0) {
            setPlName(currentPl.name);
            utils.alertWarn(t("playlist_name_empty"));
            return;
        }

        if(val === currentPl.name) {
            return;
        }

        PlaylistApi.rename(currentPl.dbId, val).then(() => {
            dispatch(playlistsActions.renamePlaylist({
                id: currentPl.id,
                newName: val
            }));

            utils.alertInfo(t("playlist_renamed", {oldName: currentPl.name}));
        }).catch((err: ApiError) => {
            setPlName(currentPl.name);
            err.alert();
        });
    }, [t, dispatch, currentPl.name, currentPl.dbId, currentPl.id]);


    useEffect(() => {
        if(currentPl.id !== prevPl) {
            setPlName(currentPl.name);
        }
    }, [currentPl.id, prevPl, currentPl.name]);

    return (
        <KeyTransition tkey={currentPl.id.toString()}>
            <div className="main-header">
                <EditableHeader
                    maxlength={30}
                    readonly={currentPl.id === -1} 
                    placeholder="playlist_name"
                    value={currentPl.id === -1 ? t("all_tracks_playlist_name") : plName} 
                    onInput={setPlName} 
                    onChange={handlePlaylistNameChange}
                />
            </div>
        </KeyTransition>
    );
}

export default MainHeader;