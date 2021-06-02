import { useRef, useState } from "react";
import { useComponentDidMount } from "../../../lib/hooks";
import utils from "../../../lib/utils";

type TrackBuffer = {
    left: number,
    width: number
}

let throttle = false;

function MusicSeekbar() {
    const [buffer, setBuffer] = useState<TrackBuffer[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const seekLineRef = useRef<HTMLDivElement>(null);

    function handleSeek(e: React.MouseEvent<HTMLElement>) {
        if(!seekLineRef.current) {
            return;
        }
        
        const widthPrec = e.nativeEvent.offsetX / (seekLineRef.current.offsetWidth / 100);
        throttle = false;
        window.player.currentTime = window.player.duration / 100 * widthPrec;
    }

    useComponentDidMount(() => {
        function playerProgress() {
            const d = window.player.duration;

            const newBuffer = [];
            for(let i = 0; i < window.player.buffered.length; i++) {
                let from = window.player.buffered.start(i);
                let to = window.player.buffered.end(i);

                let fromPrec = from / (d / 100);
                let toPrec = to / (d / 100);

                newBuffer.push({
                    left: fromPrec,
                    width: toPrec - fromPrec
                });
            }

            setBuffer(newBuffer);
        }

        function playerDurationChange() {
            setDuration(window.player.duration);
        }

        function playerTimeUpdate() {
            if(!throttle) {
                if(!window.player.paused) {
                    window.localStorage.setItem("lastPlaybackState", window.player.currentTime.toString());
                }

                setCurrentTime(window.player.currentTime);
            }

            throttle = !throttle;
        }

        const lastPlaybackState = parseFloat(window.localStorage.getItem("lastPlaybackState") as string);

        if(!Number.isNaN(lastPlaybackState)) {
            const setTime = function() {
                if(window.player.duration > lastPlaybackState && window.player.readyState >= 1) {
                    window.player.currentTime = lastPlaybackState;
                    window.player.removeEventListener("canplay", setTime);
                }
            };

            window.player.addEventListener("canplay", setTime);
            setCurrentTime(lastPlaybackState);
        }

        window.player.addEventListener("timeupdate", playerTimeUpdate);
        window.player.addEventListener("durationchange", playerDurationChange);
        window.player.addEventListener("progress", playerProgress);

        return () => {
            window.player.removeEventListener("timeupdate", playerTimeUpdate);
            window.player.removeEventListener("durationchange", playerDurationChange);
            window.player.removeEventListener("progress", playerProgress);
        };
    });

    const seekWidth = currentTime / (duration / 100);

    return (
        <div className="music-seekbar">
            <div className="seekbar-line" ref={seekLineRef} onClick={handleSeek}>
                <div className="seekbar-progress" style={{width: seekWidth + "%"}} />
                <ul className="seekbar-buffer">
                    {buffer.map((b, index) => (
                        <li key={index} style={{left: b.left+"%", width: b.width+"%"}} />
                    ))}
                </ul>
            </div>

            <div className="seekbar-times">
                <span className="current">{utils.getTime(currentTime)}</span>
                <span className="duration">{utils.getTime(duration)}</span>
            </div>
        </div>
    );
}

export default MusicSeekbar;