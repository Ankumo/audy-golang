import React, { useCallback, useEffect, useRef, useState } from "react";
import { TracksRepeat } from "../../../lib/enums";
import { useComponentDidMount } from "../../../lib/hooks";
import utils from "../../../lib/utils";
import { selector, useAppDispatch } from "../../../store/hooks";
import { tracksActions } from "../../../store/reducers/tracks";
import { play } from "../../../store/thunks";
import Slider from "../../Forms/Slider";
import KeyTransition from "../../Helpers/KeyTransition";

let preMuteVolume = 0;
const maxRepeat = Math.max(...utils.getEnumValues(TracksRepeat) as number[]);

function MusicControls() {
    const src = selector(state => state.tracks.src);
    const playback = selector(state => state.tracks.playback);
    const repeat = selector(state => state.tracks.repeat);
    const appTitle = selector(state => state.root.appTitle);
    const originalPlayback = useRef<string[]>([]);

    const [playBtnSrc, setPlayBtnSrc] = useState<"play" | "pause">("play");
    const [volume, setVolume] = useState(0);

    const trackInfoRef = useRef<HTMLDivElement>(null);

    const dispatch = useAppDispatch();

    const handlePlayerPause = useCallback(() => {
        setPlayBtnSrc("play");
    }, []);

    const handlePlayerPlay = useCallback(() => {
        setPlayBtnSrc("pause");
    }, []);

    const handlePlaybackBtn = useCallback((next: boolean = true) => {
        if(src === null || playback.length === 0) {
            return;
        }

        const wasPaused = window.player.paused && !window.player.ended;

        window.player.pause();
        let index = playback.indexOf(src.md5);

        if(next) {
            index++;

            if(index >= playback.length) {
                index = 0;
            }
        } else {
            index--;

            if(index < 0) {
                index = playback.length - 1;
            }
        }

        dispatch(play(playback[index], !wasPaused));
    }, [playback, src, dispatch]);

    const handlePlayBtn = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        if(src === null) {
            window.player.pause();

            if(playback.length === 0) {
                return;
            }

            dispatch(play(playback[0]));
        }

        if(window.player.paused) {
            window.player.play();

            if(src !== null) {
                document.title = utils.formatTrack(src);
            }   
        } else {
            window.player.pause();
            document.title = appTitle;
        }
    }, [src, dispatch, playback, appTitle]);

    const handlePlayerEnded = useCallback(() => {
        switch(repeat) {
            case TracksRepeat.ALL:
            case TracksRepeat.SHUFFLE:
                handlePlaybackBtn();
                break;
            case TracksRepeat.ONE:
                window.player.pause();
                window.player.currentTime = 0;
                window.player.play();
                break;
        }
    }, [repeat, handlePlaybackBtn]);

    const handleVolumeChange = useCallback((newVolume: number) => {
        setVolume(newVolume);

        window.localStorage.setItem("lastVolume", newVolume.toString());
        window.player.volume = utils.getLogVolume(newVolume);
    }, []);

    const handleMuteBtn = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        if(volume === 0) {
            if(preMuteVolume === 0) {
                preMuteVolume = 10;
            }
    
            handleVolumeChange(preMuteVolume);
        } else {
            preMuteVolume = volume;

            handleVolumeChange(0);
        }
    }, [handleVolumeChange, volume]);

    const handleRepeatBtn = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }
        
        const newRepeat = repeat + 1 > maxRepeat ? 0 : repeat + 1;

        if(newRepeat === TracksRepeat.SHUFFLE) {
            originalPlayback.current = playback;
            dispatch(tracksActions.setPlayback(utils.shuffle(playback)));
        } else if(newRepeat === TracksRepeat.ALL && originalPlayback.current) {
            dispatch(tracksActions.setPlayback(originalPlayback.current));
        }

        dispatch(tracksActions.setRepeat(newRepeat));
    }, [repeat, dispatch, playback]);

    useEffect(() => {
        window.player.addEventListener("pause", handlePlayerPause);
        window.player.addEventListener("play", handlePlayerPlay);
        window.player.addEventListener("ended", handlePlayerEnded);

        if(navigator.mediaSession !== undefined) {
            navigator.mediaSession.setActionHandler("nexttrack", handlePlaybackBtn);
            navigator.mediaSession.setActionHandler("previoustrack", () => handlePlaybackBtn(false));
        }

        return () => {
            window.player.removeEventListener("pause", handlePlayerPause);
            window.player.removeEventListener("play", handlePlayerPlay);
            window.player.removeEventListener("ended", handlePlayerEnded);
        }
    }, [handlePlayerPause, handlePlayerPlay, handlePlayerEnded, handlePlaybackBtn]);

    useComponentDidMount(() => {
        const lastVolume = parseInt(window.localStorage.getItem("lastVolume") ?? "");
        handleVolumeChange(Number.isNaN(lastVolume) ? 10 : lastVolume);
    });

    let volumeIcon = "h";
    if(volume === 0) {
        volumeIcon = "mute";
    } else if(volume < 33) {
        volumeIcon = "l";
    } else if(volume < 66) {
        volumeIcon = "m";
    }

    return (
        <div className="music-controls">
            <ul className="player-buttons left">
                <li>
                    <img 
                        draggable={false} 
                        className="svg hover"
                        src="/img/player/back.svg" 
                        alt="prev_icon" 
                        onClick={e => {if(e.button === 0) handlePlaybackBtn(false)}}  
                    />
                </li>
                <li>
                    <img 
                        draggable={false} 
                        src={`/img/player/${playBtnSrc}.svg`} 
                        alt="play_icon" 
                        className="svg hover"
                        onClick={handlePlayBtn}  
                    />
                </li>
                <li>
                    <img 
                        draggable={false} 
                        src="/img/player/next.svg" 
                        alt="next_icon" 
                        className="svg hover"
                        onClick={e => {if(e.button === 0) handlePlaybackBtn()}} 
                    />
                </li>
            </ul>

            <KeyTransition tkey={src?.md5 ?? "-"} nodeRef={trackInfoRef}>
                <div className="track-info" ref={trackInfoRef}>
                    <img 
                        draggable={false} 
                        alt="album_image" 
                        src={src !== null && src.has_image ? utils.apiProxy("albumimage", "/" + src.md5) : "/img/default_album.png"} 
                    />
                    <div>
                        <span className="track-title">{src?.title ?? "-"}</span>
                        <span className="track-artist">{src?.artist ?? "-"}</span>
                    </div>
                </div>
            </KeyTransition>

            <ul className="player-buttons right">
                <li className="volume">
                    <span>{volume}%</span>
                    <Slider 
                        min={0} 
                        max={100} 
                        step={1} 
                        value={volume} 
                        onInput={handleVolumeChange} 
                    />
                </li>
                <li className="mute">
                    <img 
                        draggable={false} 
                        className="svg hover"
                        alt="mute_icon" 
                        src={`/img/player/vol_${volumeIcon}.svg`} 
                        onClick={handleMuteBtn}  
                    />
                </li>
                <li className="repeat">
                    <img 
                        draggable={false} 
                        alt="repeat_icon" 
                        className="svg hover"
                        src={`/img/player/repeat_${repeat}.svg`} 
                        onClick={handleRepeatBtn}  
                    />
                </li>
            </ul>
        </div>
    );
}

export default MusicControls;