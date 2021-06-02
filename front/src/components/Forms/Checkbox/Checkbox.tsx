import { ClassConditioner } from "../../../lib/utils";
import React from 'react';
import { TKey } from "../../../lib/types";
import { useTranslation } from "react-i18next";

interface CheckboxProps {
    checked?: boolean,
    label?: TKey<"checkbox">,
    onChange?: (val: boolean) => void,
    disabled?: boolean
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>((props, ref) => {
    const {t} = useTranslation("checkbox");

    function handleClick() {
        if(props.disabled) {
            return;
        }
        
        if(props.onChange) {
            props.onChange(!props.checked);
        }
    }

    const classes = new ClassConditioner({
        checkbox: true,
        label: props.label !== undefined && props.label.length > 0,
        checked: props.checked ?? false,
        disabled: props.disabled ?? false
    });

    return (
        <div className={classes.computed} ref={ref} onClick={handleClick}>
            {props.label ? t(props.label) : ""}
        </div>
    );
});

export default Checkbox;