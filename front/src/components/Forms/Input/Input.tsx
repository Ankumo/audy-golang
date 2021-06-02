import React from "react";
import { useTranslation } from "react-i18next";
import { TKey } from "../../../lib/types";
import { ClassConditioner } from "../../../lib/utils";

export interface InputProps {
    placeholder?: TKey<"placeholder">,
    multiline?: boolean,
    type?: "text" | "email" | "password" | "number",
    value?: string,
    disabled?: boolean,
    required?: boolean,
    min?: number,
    max?: number,
    minlength?: number,
    maxlength?: number,
    pattern?: string,
    readonly?: boolean,
    onChange?: (val: string) => void,
    onInput?: (val: string) => void
}

let prevValue = "";

function Input(props: InputProps) {
    const {t} = useTranslation("placeholder");

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        if(props.onInput) {
            props.onInput(e.target.value);
        }
    }

    function handleBlur(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
        if(props.onChange && prevValue !== e.target.value) {
            props.onChange(e.target.value);
        }
    }

    function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
        prevValue = e.target.value;
    }

    let elem = (
        <input 
            value={props.value}
            readOnly={props.readonly}
            disabled={props.disabled}
            required={props.required}
            min={props.min}
            max={props.max}
            minLength={props.minlength}
            maxLength={props.maxlength}
            pattern={props.pattern}
            type={props.type || "text"} 
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
        />
    );

    if(props.multiline) {
        elem = (
            <div>
                <textarea 
                    value={props.value}
                    disabled={props.disabled}
                    readOnly={props.readonly}
                    rows={7} 
                    minLength={props.minlength}
                    maxLength={props.maxlength}
                    required={props.required}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </div>
        );
    }

    const classes = new ClassConditioner({
        "form-input": true,
        "has-value": props.value !== undefined && props.value.length > 0,
        multiline: props.multiline ?? false,
        disabled: props.disabled ?? false
    });

    const ph = props.placeholder ? t(props.placeholder) : "";

    return (
        <div className={classes.computed} data-placeholder={ph} title={ph}>
            {elem}
        </div>
    );
}

export default Input;