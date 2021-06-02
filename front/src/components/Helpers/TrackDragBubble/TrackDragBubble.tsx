import { selector } from "../../../store/hooks";
import Appear from "../Appear";

interface TrackDragBubbleProps {
    count: number,
    pos: {
        x: number,
        y: number
    }
}

function TrackDragBubble(props: TrackDragBubbleProps) {
    const dragging = selector(state => state.tracks.dragging.length > 0);
    
    const offset = 4;
    const count = props.count > 99 ? "99+" : props.count;
    const top = (props.pos.y + offset) + "px";
    const left = (props.pos.x + offset) + "px";

    return (
        <Appear mounty cond={dragging} classNames="track-drag-appear">
            <div className="track-drag-bubble">
                <div className="counter" style={{top, left}}>
                    {count}
                </div>
                {props.count > 1 && 
                    <div className="spread-1" style={{top, left}}></div>
                } 
                {props.count > 2 && 
                    <div className="spread-2" style={{top, left}}></div>
                } 
            </div>
        </Appear>
    );
}

export default TrackDragBubble;