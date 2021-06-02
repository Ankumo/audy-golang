import React, { useRef } from "react";
import { Track } from "../../../../lib/types";
import utils from "../../../../lib/utils";
import { selector } from "../../../../store/hooks";
import Checkbox from "../../../Forms/Checkbox";
import KeyTransition from "../../../Helpers/KeyTransition";

interface TracklistItemProps {
    track: Track,
    num: number,
    selectMode: boolean,
    onMouseDown: React.MouseEventHandler<HTMLTableRowElement>,
    onMouseUp: React.MouseEventHandler<HTMLTableRowElement>,
    onMouseEnter: React.MouseEventHandler<HTMLTableRowElement>,
    onMouseLeave: React.MouseEventHandler<HTMLTableRowElement>,
    active: boolean
}

function TracklistItem(props: TracklistItemProps) {
    const selected = selector(state => state.tracks.selected.includes(props.track.md5));
    const rootRef = useRef<HTMLTableRowElement>(null);

    return (
        <tr 
            data-hash={props.track.md5} 
            ref={rootRef}
            className={props.active ? "active" : ""} 
            onMouseLeave={props.onMouseLeave} 
            onMouseDown={props.onMouseDown} 
            onMouseUp={props.onMouseUp} 
            onMouseEnter={props.onMouseEnter}
        >
            <td className="num">
                <KeyTransition timeout={100} tkey={props.selectMode.toString()}>
                    {props.selectMode ? 
                        <Checkbox checked={selected} /> 
                        :
                        <span>{props.num}</span>
                    }
                </KeyTransition>
            </td>
            <td className="name">
                <span>{props.track.artist} </span>
                - {props.track.title}
            </td>
            <td className="duration">
                <span>{utils.getTime(props.track.duration)}</span>
            </td>
        </tr>
    );
}

export default TracklistItem;