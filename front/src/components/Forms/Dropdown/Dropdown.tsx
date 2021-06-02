import React, { MouseEvent, useEffect, useRef, useState } from "react";
import { useCloseableWidthAdjustment } from "../../../lib/hooks";
import { DropdownAction } from "../../../lib/types";
import { ClassConditioner, eventBus } from "../../../lib/utils";
import DropdownItem from '../DropdownItem';

interface DropdownProps {
    items: DropdownAction[],
    onAction?: (key: string | number) => void,
    naked?: boolean,
    noScroll?: boolean,
    iconOnly?: boolean,
    width?: string,
    placeholder?: string,
    tns?: string,
    icon?: string,
    children?: React.ReactNode
}

function Dropdown(props: DropdownProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    useCloseableWidthAdjustment(props, rootRef);

    const [opened, setOpened] = useState(false);

    function itemClick(val: string | number) {
        if(props.onAction) {
            props.onAction(val);
        }

        if(opened) {
            setOpened(false);
        }
    }

    const classes = new ClassConditioner({
        dropdown: true,
        closeable: true,
        naked: props.naked ?? false,
        "no-scroll": props.noScroll ?? false,
        "icon-only": props.iconOnly ?? false,
        opened
    });

    useEffect(() => {
        function close(e: CustomEventInit<MouseEvent>) {
            if(opened) {
                setOpened(false);
            }
        }

        eventBus.on("ddclose", close);
        return () => {
            eventBus.unsub("ddclose", close);
        }
    }, [opened]);
        
    return (
        <div className={classes.computed} ref={rootRef}>
            <div onClick={() => setOpened(!opened)}>
                {props.children || 
                    <>
                        {props.icon &&
                            <img 
                                src={`/img/${props.icon}.svg`} 
                                className={props.iconOnly ? "svg hover" : "svg"} 
                                alt="dropdown_icon" 
                                draggable={false}
                            />
                        }
                        
                        {!props.iconOnly && <span>{props.placeholder || ""}</span>}
                    </>
                }
            </div>

            <ul>
                {props.items.map((i, index) => (
                    <DropdownItem key={i.value || `__undefined_index_${index}__`} tns={props.tns} onClick={itemClick} {...i} />
                ))}
            </ul>
        </div>
    );
}

export default Dropdown;