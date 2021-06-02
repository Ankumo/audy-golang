import React, { useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TKey } from "../../../lib/types";
import { ClassConditioner } from "../../../lib/utils";

interface EditableHeaderProps {
    value: string,
    onChange?: (val: string, oldVal?: string) => void,
    onInput: (val: string) => void,
    placeholder?: TKey<"placeholder">,
    readonly?: boolean,
    maxlength?: number,
    minlength?: number,
    pattern?: string,
    required?: boolean
}

const EditableHeader = React.forwardRef<HTMLDivElement, EditableHeaderProps>((props, ref) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const prevValue = useRef("");

    const {t} = useTranslation("placeholder");

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        prevValue.current = e.target.value;
    }, []);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if(prevValue.current !== e.target.value && props.onChange) {
            props.onChange(e.target.value, prevValue.current);
        }

        if(spanRef.current) {
            spanRef.current.parentElement!.scrollLeft = 0;
        }
    }, [props]);

    const handleContainerClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(inputRef.current && e.target !== inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const ph = props.placeholder ? t(props.placeholder) : undefined;

    useLayoutEffect(() => {
        if(spanRef.current && inputRef.current) {
            inputRef.current.style.width = spanRef.current.offsetWidth + "px";
        }
    });

    const classes = new ClassConditioner({
        "editable-header": true,
        readonly: props.readonly ?? false,
        "has-value": props.value.length > 0
    });

    return (
        <div ref={ref} className={classes.computed} title={ph} onClick={handleContainerClick}>
            <input 
                type="text" 
                value={props.value} 
                maxLength={props.maxlength}
                ref={inputRef}
                readOnly={props.readonly}
                minLength={props.minlength}
                required={props.required}
                pattern={props.pattern}
                onChange={e => props.onInput(e.target.value)} 
                onBlur={handleBlur}
                onFocus={handleFocus}
            />
            <span ref={spanRef}>{props.value.length > 0 ? props.value : (ph ?? "")}</span>
        </div>
    );
});

export default EditableHeader;