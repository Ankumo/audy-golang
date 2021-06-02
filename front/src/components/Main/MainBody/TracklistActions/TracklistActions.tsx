import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { PlaylistApi } from "../../../../lib/api";
import { PlaylistActions, TracksSort } from "../../../../lib/enums";
import utils from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { playlistsActions } from "../../../../store/reducers/playlists";
import { rootActions } from "../../../../store/reducers/root";
import { filteredTracks, tracksActions } from "../../../../store/reducers/tracks";
import Button from "../../../Forms/Button";
import Dropdown from "../../../Forms/Dropdown";
import Select from "../../../Forms/Select";
import KeyTransition from "../../../Helpers/KeyTransition";

interface TracklistActionsProps {

}

function TracklistActions(props: TracklistActionsProps) {
    const editMode = selector(state => state.root.editMode);
    const selectMode = selector(state => state.root.selectMode);
    const currentPl = selector(state => state.playlists.list[state.playlists.current]);
    const displayedTracks = selector(filteredTracks);
    const selectedTracks = selector(state => state.tracks.selected);
    const displayTracksCount = editMode || selectMode ? selectedTracks.length : displayedTracks.length;
    const searchString = selector(state => state.root.searchString);
    const currentSort = selector(state => state.tracks.sort);

    const dispatch = useAppDispatch();
    const {t} = useTranslation();

    const [loading, setLoading] = useState(false);

    let trackCountTrans: React.ReactElement;

    if(searchString.length > 0) {
        trackCountTrans = <Trans i18nKey="found_tracks_counter" values={{count: displayTracksCount}} />;
    } else if(selectMode) {
        trackCountTrans = <Trans i18nKey="playlist_selected_tracks_count" values={{count: selectedTracks.length}} />;
    } else {
        trackCountTrans = <Trans i18nKey="playlist_tracks_count" values={{count: displayTracksCount}} />;
    }

    async function handleDoneBtn(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        if(editMode) {
            const tracks = [...currentPl.tracks].filter(t => selectedTracks.includes(t));

            for(let i = 0; i < selectedTracks.length; i++) {
                if(!tracks.includes(selectedTracks[i])) {
                    tracks.splice(0, 0, selectedTracks[i]);
                }
            }

            setLoading(true);
            const updatingPlaylist = currentPl.id;
            await PlaylistApi.update(currentPl.id, tracks).then(() => {
                dispatch(playlistsActions.updateTracks({
                    id: updatingPlaylist,
                    tracks
                }));
                
                dispatch(rootActions.setSelectMode(false));
            }).catch(() => {});
            setLoading(false);
        } else if(selectMode) {
            dispatch(rootActions.setSelectMode(false));
        }

        dispatch(tracksActions.setSelected([]));
    }

    function handleCancelBtn(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        dispatch(tracksActions.setSelected([]));
        dispatch(rootActions.setEditMode(false));
    }

    function handlePlaylistAction(action: PlaylistActions) {
        switch(action) {
            case PlaylistActions.DELETE:
                utils.confirmT("confirm_remove_playlist", {plName: currentPl.name}, () => {
                    return PlaylistApi.remove(currentPl.id).then(() => {
                        dispatch(playlistsActions.removePlaylist(currentPl.id));
                        utils.alertInfo(t("playlist_removed", {plName: currentPl.name}));
                    }).catch(() => {});
                });
                break;
            case PlaylistActions.EDIT:
                dispatch(rootActions.setEditMode(true));
                dispatch(tracksActions.setSelected([...currentPl.tracks]));
                break;
            case PlaylistActions.SELECT:
                dispatch(rootActions.setSelectMode(true));
                break;
        }
    }

    return (
        <div className="tracklist-actions">
            <KeyTransition tkey={currentPl.id.toString() + "_" + displayedTracks + "_" + (searchString.length > 0)}>
                <div className="left">
                    <span className="tracks-count">
                        {trackCountTrans}
                    </span>

                    {selectMode && <Button text="done" icon="done" loading={loading} onClick={handleDoneBtn} />}
                    {editMode && <Button text="cancel" icon="cancel" onClick={handleCancelBtn} />}
                    {currentPl.id !== -1 && !selectMode &&
                        <Dropdown 
                            naked 
                            noScroll 
                            iconOnly 
                            tns="playlistActions" 
                            icon="dots" 
                            items={[
                                {
                                    value: PlaylistActions.EDIT,
                                    icon: "edit"
                                },
                                {
                                    value: PlaylistActions.SELECT,
                                    icon: "done",
                                    cond: displayTracksCount > 0
                                },
                                { divider: true },
                                {
                                    value: PlaylistActions.DELETE,
                                    icon: "trash"
                                }
                            ]} 
                            onAction={action => handlePlaylistAction(action as PlaylistActions)} 
                        />
                    }
                </div>
            </KeyTransition>

            <Select 
                tns="tracksSort" 
                naked
                value={currentSort} 
                options={[
                    { value: TracksSort.CUSTOM },
                    { value: TracksSort.TIMESTAMP_ASC },
                    { value: TracksSort.TIMESTAMP_DESC },
                    { value: TracksSort.ARTIST_ASC },
                    { value: TracksSort.ARTIST_DESC },
                    { value: TracksSort.TITLE_ASC },
                    { value: TracksSort.TITLE_DESC },
                    { value: TracksSort.DURATION_ASC },
                    { value: TracksSort.DURATION_DESC }
                ]} 
                onChange={val => dispatch(tracksActions.setSort(val as number))} 
            />
        </div>
    );
}

export default TracklistActions;