import MusicControls from "../MusicControls";
import MusicSeekbar from "../MusicSeekbar";

function MusicBar() {
    return (
        <div className="musicbar">
            <div className="musicbar-wrapper">
                <MusicSeekbar />
                <MusicControls />
            </div>
        </div>
    );
}

export default MusicBar;