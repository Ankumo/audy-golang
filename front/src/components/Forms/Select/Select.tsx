import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloseableWidthAdjustment } from "../../../lib/hooks";
import { DropdownAction } from "../../../lib/types";
import { ClassConditioner, eventBus } from "../../../lib/utils";
import KeyTransition from "../../Helpers/KeyTransition";
import DropdownItem from '../DropdownItem';

interface SelectProps {
    options: DropdownAction[],
    tns?: string,
    placeholder?: string,
    icon?: string,
    width?: string,
    disabled?: boolean,
    onChange: (newVal?: string | number) => void,
    value?: string | number,
    naked?: boolean,
    noScroll?: boolean,
    noCaret?: boolean
}

function Select(props: SelectProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    useCloseableWidthAdjustment(props, rootRef);

    const [opened, setOpened] = useState(false);

    const {i18n} = useTranslation();

    const handleOptionClick = useCallback((key: string | number) => {
        props.onChange(key);

        if(opened) {
            setOpened(false);
        }
    }, [opened, props]);

    let ph = props.placeholder;

    if(props.value !== undefined) {
        const option = props.options.find(o => { return o.value === props.value});

        if(option) {
            ph = option.text || i18n.t(props.tns ? `${props.tns}:${option.value}` : option.value!.toString());
        }
    }

    const classes = new ClassConditioner({
        select: true,
        closeable: true,
        disabled: props.disabled ?? false,
        naked: props.naked ?? false,
        "no-scroll": props.noScroll ?? false,
        "no-caret": props.noCaret ?? false,
        opened
    });

    useEffect(() => {
        function close() {
            if(opened) {
                setOpened(false);
            }
        }

        eventBus.on("ddclose", close);

        return () => {
            eventBus.unsub("ddclose", close);
        }
    })

    return (
        <div className={classes.computed} ref={rootRef}>
            <KeyTransition tkey={props.value?.toString() ?? ""}>
                <div onClick={() => setOpened(!opened)}>
                    {props.icon && 
                        <img draggable={false} className="svg" src={`/img/${props.icon}.svg`} alt="select_icon" />
                    }
                    <span>{ph}</span> 
                </div>
            </KeyTransition>

            <ul>
                {props.options.map((o, index) => (
                    <DropdownItem 
                        key={o.value || `__undefined_index_${index}__`} onClick={handleOptionClick}
                        tns={props.tns}
                        active={o.value === props.value}
                        {...o}  
                    />
                ))}
            </ul>
        </div>
    );
}

export default Select;