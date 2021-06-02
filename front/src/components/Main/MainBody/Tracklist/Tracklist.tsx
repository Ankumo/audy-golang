import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaylistApi, TrackApi } from "../../../../lib/api";
import { TracklistItemActions, TracksRepeat, TracksSort } from "../../../../lib/enums";
import { Track } from "../../../../lib/types";
import utils, { ClassConditioner } from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { playlistsActions } from "../../../../store/reducers/playlists";
import { createModal, rootActions } from "../../../../store/reducers/root";
import { filteredTracks, tracksActions } from "../../../../store/reducers/tracks";
import { play } from "../../../../store/thunks";
import ContextMenu from "../../../Forms/ContextMenu";
import KeyTransition from "../../../Helpers/KeyTransition";
import NoItems from "../../../Helpers/NoItems";
import TrackDragBubble from "../../../Helpers/TrackDragBubble";
import TracklistItem from "../TracklistItem";

type MovingTrackData = {
    track: Track,
    row: HTMLElement,
    dotsBounds: DOMRect,
    index: number
}

interface TracklistProps {

}

let mouseDowned = false, 
    multiselect = false, 
    multiselectType = false;
    
let mouseDownTimeout = window.setTimeout(() => {}, 1);

let pendingMultiselectTrack: Track | null = null;
let movingTrack: MovingTrackData | null = null;
let movingPlaceholder: HTMLTableRowElement;

let throttle = false;

function setMovingRowPos(clientX: number, clientY: number) {
    const x = window.innerWidth - clientX - 16 - movingTrack!.dotsBounds.width / 2;
    let y = clientY - (movingTrack!.row.offsetHeight / 2);

    const lowBound = window.innerHeight - 86 - movingTrack!.row.offsetHeight;

    if(y > lowBound) {
        y = lowBound;
    }

    movingTrack!.row.style.right = x + "px";
    movingTrack!.row.style.top = y + "px";
}

function Tracklist(props: TracklistProps) {
    const currentPl = selector(state => state.playlists.list[state.playlists.current]);
    const displayedTracks = selector(filteredTracks);
    const searchString = selector(state => state.root.searchString);
    const selectMode = selector(state => state.root.selectMode);
    const isAdmin = selector(state => state.user.is_admin);
    const tracksSort = selector(state => state.tracks.sort);
    const selectedTracks = selector(state => state.tracks.selected);
    const draggingTracks = selector(state => state.tracks.dragging);
    const playbackPlId = selector(state => state.playlists.playbacked);
    const src = selector(state => state.tracks.src);
    const playbackTracks = selector(state => state.tracks.playback);
    const lib = selector(state => state.tracks.lib);

    const tbodyRef = useRef<HTMLTableSectionElement>(null);

    const [multipleChoosen, setMultipleChoosen] = useState(false);
    const [dragPos, setDragPos] = useState({x: 0, y: 0});
    const [dragging, setDragging] = useState(false);

    const dispatch = useAppDispatch();
    const {t} = useTranslation();

    let noItems: JSX.Element | null = null;

    if(displayedTracks.length === 0) {
        if(searchString.length > 0) {
            noItems = (
                <NoItems 
                    text={t("no_tracks_in_search", {str: searchString})}
                    icon="search"
                    btnText="cancel_search"
                    btnClick={() => dispatch(rootActions.setSearchString(""))} 
                />
            );
        } else {
            const showUpload = currentPl.id === -1 && isAdmin;
            noItems = (
                <NoItems 
                    text={currentPl.id === -1 ? t("no_tracks_in_lib") : t("no_tracks_in_playlist")}
                    btnText={showUpload ? "open_upload" : undefined}
                    btnClick={showUpload ? () => dispatch(createModal("Upload", {})) : undefined}
                    header={currentPl.id === -1 ? t("no_tracks_in_lib_header") : t("no_tracks_in_playlist_header")} 
                />
            );
        }
    }

    const tableSortable = tracksSort === TracksSort.CUSTOM && searchString.length === 0 &&
        !selectMode && displayedTracks.length > 0;

    function handleItemAction(action: TracklistItemActions, track: Track) {
        switch(action) {
            case TracklistItemActions.DELETE:
                if(selectMode && selectedTracks.includes(track.md5)) {
                    const tracks = currentPl.tracks.filter(t => !selectedTracks.includes(t));

                    utils.confirmT("confirm_remove_tracks", {count: selectedTracks.length, plName: currentPl.name}, () => {                  
                        return PlaylistApi.update(currentPl.dbId, tracks).then(() => {
                            dispatch(playlistsActions.updateTracks({
                                id: currentPl.id,
                                tracks
                            }));

                            utils.alertInfo(t("playlist_tracks_removed", {count: selectedTracks.length, plName: currentPl.name}));

                            if(tracks.length === 0) {
                                dispatch(tracksActions.setSelected([]));
                                dispatch(rootActions.setSelectMode(false));
                            }
                        });
                    });
                } else {
                    const tracks = currentPl.tracks.filter(t => t !== track.md5);
                    utils.confirmT("confirm_remove_track", {trackName: utils.formatTrack(track), plName: currentPl.name}, () => {
                        return PlaylistApi.update(currentPl.dbId, tracks).then(() => {
                            dispatch(playlistsActions.updateTracks({
                                id: currentPl.id,
                                tracks
                            }));
                            
                            utils.alertInfo(t("playlist_track_removed", {trackName: utils.formatTrack(track), plName: currentPl.name}));

                            if(tracks.length === 0) {
                                dispatch(rootActions.setSelectMode(false));
                            }
                        });
                    });
                }
                break;
            case TracklistItemActions.DELETE_FROM_LIB:
                if(selectMode && selectedTracks.includes(track.md5)) {
                    utils.confirmT("confirm_remove_tracks", {count: selectedTracks.length, plName: t("all_tracks_playlist_name")}, () => {                  
                        return TrackApi.remove(selectedTracks).then(() => {
                            utils.alertInfo(t("tracks_removed", {count: selectedTracks.length}));

                            if(displayedTracks.length === 0) {
                                dispatch(tracksActions.setSelected([]));
                                dispatch(rootActions.setSelectMode(false));
                            }
                        });
                    });
                } else {
                    utils.confirmT("confirm_remove_track", {trackName: utils.formatTrack(track), plName: t("all_tracks_playlist_name")}, () => {
                        return TrackApi.remove([track.md5]).then(() => {
                            utils.alertInfo(t("track_removed", {trackName: utils.formatTrack(track)}));

                            if(displayedTracks.length === 0) {
                                dispatch(rootActions.setSelectMode(false));
                            }
                        });
                    });
                }
                break;
            case TracklistItemActions.EDIT:
                dispatch(createModal("EditTrack", { track }));
                break;
            case TracklistItemActions.SHOW_LYRICS:
                //TODO TODO TODO TODO TODO TODO TODO TODO 
                break;
            case TracklistItemActions.DOWNLOAD:
                window.open(utils.proxy("download/" + track.md5));
                break;
        }
    }

    function handleMouseDown(e: React.MouseEvent<HTMLElement>, track: Track) {
        if(e.button !== 0) {
            return;
        }

        const target = e.target as HTMLElement;
        const row = utils.findParentWithTagName(target, "tr");

        if(row === null) {
            return;
        }

        if(selectMode) {
            if(row.firstChild!.contains(target)) {
                pendingMultiselectTrack = track;
                multiselectType = !selectedTracks.includes(track.md5);
                return;
            }
        } else {
            if(row.lastChild!.contains(target) && tableSortable) {
                movingTrack = { 
                    row, track, 
                    dotsBounds: row.lastElementChild!.firstElementChild!.getBoundingClientRect(),
                    index: currentPl.tracks.indexOf(track.md5)
                };
            }
        }

        mouseDowned = true;
        mouseDownTimeout = window.setTimeout(() => {
            onDragDelayed(e, track);
        }, 500);
    }

    function handleMouseEnter(e: React.MouseEvent<HTMLElement>, track: Track) {
        if(pendingMultiselectTrack !== null) {
            const target = e.target as HTMLElement;
            const tr = utils.findParentWithTagName(target, "tr");

            if(tr === null) {
                return;
            }

            if(tr.firstChild!.contains(target)) {
                multiselect = true;

                if(multiselectType) {
                    dispatch(tracksActions.select([pendingMultiselectTrack.md5, track.md5]));
                } else {
                    dispatch(tracksActions.deselect([pendingMultiselectTrack.md5, track.md5]));
                }
            }

            pendingMultiselectTrack = null;
            return;
        }

        if(multiselect) {
            if((multiselectType && selectedTracks.includes(track.md5)) || (!multiselectType && !selectedTracks.includes(track.md5))) {
                return;
            } 

            const target = e.target as HTMLElement;
            const tr = utils.findParentWithTagName(target, "tr");

            if(tr === null) {
                return;
            }

            if(tr.firstChild!.contains(target)) {
                if(multiselectType) {
                    dispatch(tracksActions.select([track.md5]));
                } else {
                    dispatch(tracksActions.deselect([track.md5]));
                }
            }
        }
    }

    function handleMouseLeave(e: React.MouseEvent<HTMLElement>, track: Track) {
        if(mouseDowned && !dragging) {
            const row = utils.findParentWithTagName(e.target as HTMLElement, "tr");

            if(row !== null) {
                clearTimeout(mouseDownTimeout);
                onDragDelayed(e, track);
            }
        }
    }

    function handleMouseUp(e: React.MouseEvent<HTMLElement>, track: Track) {
        if(e.button === 2) {
            setMultipleChoosen(contextMultiple && selectedTracks.includes(track.md5));
            return;
        }

        if(dragging || multiselect || e.button !== 0) {
            return;
        }

        if(e.ctrlKey && !selectMode) {
            dispatch(rootActions.setSelectMode(true));
            dispatch(tracksActions.setSelected([track.md5]))
            return;
        }

        if(selectMode) {
            const target = e.target as HTMLElement;
            const tr = utils.findParentWithTagName(target, "tr");

            if(tr === null) {
                return;
            }

            if(tr.firstChild!.firstChild!.contains(target)) {
                if(selectedTracks.includes(track.md5)) {
                    dispatch(tracksActions.deselect([track.md5]));
                } else {
                    dispatch(tracksActions.select([track.md5]));
                }
            }
        } else {
            if(src?.md5 !== track.md5) {
                window.player.pause();
                dispatch(play(track.md5, true));
            }
            
            dispatch(playlistsActions.setPlaybacked(currentPl.id));
            const displayedTracksHashes = displayedTracks.map(t => t.md5);

            if(JSON.stringify(playbackTracks) !== JSON.stringify(displayedTracksHashes)) {
                dispatch(tracksActions.setRepeat(TracksRepeat.ALL));
                dispatch(tracksActions.setPlayback(displayedTracksHashes));
            }
        }
    }

    function onDragDelayed(e: React.MouseEvent<HTMLElement>, track: Track) {
        setDragging(true);
        if(movingTrack !== null && tbodyRef.current) {
            movingPlaceholder = document.createElement("tr");
            movingPlaceholder.className = "moving-placeholder";
            movingPlaceholder.innerHTML = "<td colspan=\"3\"></td>";
            movingPlaceholder.style.height = movingTrack.row.offsetHeight + "px";

            movingTrack.row.style.width = movingTrack.row.offsetWidth + "px";
            movingTrack.row.classList.add("moving");

            tbodyRef.current.insertBefore(movingPlaceholder, movingTrack.row);
            return;
        }

        setDragPos({
            x: e.clientX,
            y: e.clientY
        });

        if(selectMode && selectedTracks.includes(track.md5)) {
            dispatch(tracksActions.setDragging(selectedTracks));
        } else {
            dispatch(tracksActions.setDragging([track.md5]));
        }
    }

    const handleWindowMouseUp = useCallback((e: MouseEvent) => {
        if(e.button !== 0) {
            return;
        }

        clearTimeout(mouseDownTimeout);
        mouseDowned = false;
        multiselect = false;
        pendingMultiselectTrack = null;

        if(dragging) {
            setDragging(false);

            if(movingTrack !== null) {
                if(movingTrack.index !== currentPl.tracks.indexOf(movingTrack.track.md5)) {
                    const pl = currentPl;
                    PlaylistApi.update(pl.dbId, pl.tracks).then(newDbId => {
                        if(newDbId && pl.id === -1 && newDbId > 0) {
                            dispatch(playlistsActions.setLibId(newDbId));
                        }
                    });
                }

                movingTrack.row.style.right = "";
                movingTrack.row.style.top = "";
                movingTrack.row.style.width = "";
                movingTrack.row.classList.remove("moving");
                movingTrack = null;

                if(movingPlaceholder) {
                    movingPlaceholder.remove();
                }
            }
        }

        if(draggingTracks.length > 0) {
            dispatch(tracksActions.setDragging([]));
        }
    }, [dragging, dispatch, draggingTracks, currentPl]);

    const handleSetContextRef = useCallback((el: HTMLElement) => {
        const md5 = el.getAttribute("data-hash");

        if(md5) {
            return lib[md5];
        } 

        return null;
    }, [lib]);

    useEffect(() => {
        function handleWindowMouseMove(e: MouseEvent) {
            if(throttle && dragging) {
                if(draggingTracks.length > 0) {
                    setDragPos({
                        x: e.clientX,
                        y: e.clientY
                    });
                } else if(movingTrack !== null) {
                    setMovingRowPos(e.clientX, e.clientY);

                    const placeholderBounds = movingPlaceholder.getBoundingClientRect();
                    if(e.clientY <= placeholderBounds.top) {
                        const index = currentPl.tracks.indexOf(movingTrack.track.md5);

                        if(index > 0) {
                            dispatch(playlistsActions.swapTracks({
                                track1: movingTrack.track.md5,
                                track2: currentPl.tracks[index - 1]
                            }));
                        }
                    } else if(e.clientY >= placeholderBounds.bottom) {
                        const index = currentPl.tracks.indexOf(movingTrack.track.md5);

                        if(index < currentPl.tracks.length - 1) {
                            dispatch(playlistsActions.swapTracks({
                                track1: movingTrack.track.md5,
                                track2: currentPl.tracks[index + 1]
                            }));

                            movingPlaceholder.parentElement!.insertBefore(movingPlaceholder, movingTrack.row.nextSibling);
                        }
                    }
                }
            }

            throttle = !throttle;
        }

        window.addEventListener("mouseup", handleWindowMouseUp);
        window.addEventListener("mousemove", handleWindowMouseMove);
        return () => {
            window.removeEventListener("mouseup", handleWindowMouseUp);
            window.removeEventListener("mousemove", handleWindowMouseMove);
        }
    }, [handleWindowMouseUp, dragging, draggingTracks, currentPl.tracks, dispatch]);

    const classes = new ClassConditioner({
        tracklist: true,
        "select-mode": selectMode
    });

    const contextMultiple = selectMode && selectedTracks.length > 1;

    return (
        <KeyTransition tkey={currentPl.id.toString() + "_" + (noItems === null ? "hasItems" : "noItems")}>
            <div className={classes.computed}>
                {displayedTracks.length > 0 && 
                    <>
                        <table className={tableSortable ? "sortable" : ""} cellSpacing={0} cellPadding={0}>
                            <tbody ref={tbodyRef}>
                                {displayedTracks.map((t, index) => (
                                    <TracklistItem 
                                        key={t.md5} 
                                        track={t} 
                                        num={index + 1} 
                                        selectMode={selectMode}
                                        active={currentPl.id === playbackPlId && t.md5 === src?.md5}
                                        onMouseDown={e => handleMouseDown(e, t)}
                                        onMouseUp={e => handleMouseUp(e, t)}
                                        onMouseLeave={e => handleMouseLeave(e, t)}
                                        onMouseEnter={e => handleMouseEnter(e, t)}
                                    />
                                ))}
                            </tbody>
                        </table>
                        <TrackDragBubble pos={dragPos} count={draggingTracks.length} />
                    </>
                }
                <ContextMenu<Track>
                    tns="tracklistItemActions" 
                    nodeRef={tbodyRef} 
                    multiple={contextMultiple && multipleChoosen} 
                    actions={[
                        {
                            value: TracklistItemActions.EDIT,
                            cond: isAdmin
                        },
                        {
                            value: TracklistItemActions.SHOW_LYRICS,
                            contextCond: item => item.lyrics.length > 0
                        },
                        {
                            value: TracklistItemActions.DOWNLOAD
                        },
                        {divider: true},
                        {
                            value: TracklistItemActions.DELETE,
                            cond: currentPl.id !== -1,
                            withMultiple: true
                        },
                        {
                            value: TracklistItemActions.DELETE_FROM_LIB,
                            cond: isAdmin,
                            withMultiple: true
                        }
                    ]} 
                    setRef={handleSetContextRef}
                    onAction={(action, item) => handleItemAction(action as number, item)} 
                />
                {noItems}
            </div>
        </KeyTransition>
    );
}

export default Tracklist;