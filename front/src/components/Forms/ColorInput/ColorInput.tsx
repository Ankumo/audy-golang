import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import utils, { ClassConditioner } from "../../../lib/utils";
import Input, { InputProps } from "../Input";

interface ColorInputProps extends InputProps {
    
}

function supports(color: string) {
    return CSS.supports("background", color);
}

function ColorInput(props: ColorInputProps) {
    const {t} = useTranslation();

    const bgSupported = props.value !== undefined ? supports(props.value) : true;

    function handlePickColor(e: React.MouseEvent<HTMLDivElement>) {
        if(e.button !== 0 || props.disabled || props.readonly) {
            return;
        }

        utils.pickColor(e.clientX, e.clientY, props.value).then(value => {
            if(value === null) {
                return;
            }

            if(props.onChange) {
                props.onChange(value);
            }

            if(props.onInput) {
                props.onInput(value);
            }
        });
    }

    const handleChange = useCallback((val: string) => {
        if(supports(val) && props.onChange) {
            props.onChange(val);
        }
    }, [props]);

    const classes = new ClassConditioner({
        "color-input": true,
        "not-supported": !bgSupported,
        disabled: props.disabled ?? false
    });

    return (
        <div className={classes.computed}>
            <Input {...props} onChange={handleChange} />
            <div 
                className="sample" 
                style={{background: props.value}} 
                title={bgSupported ? "" : t("invalid_color_value")}
                onClick={handlePickColor} 
            />
        </div>
    );
}

export default ColorInput;