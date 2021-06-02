import React from "react";
import { useTranslation } from "react-i18next";
import { TKey } from "../../../lib/types";
import utils from "../../../lib/utils";

interface ButtonProps {
    text: TKey<"btn">,
    accent?: "primary" | "secondary",
    onClick?: React.MouseEventHandler<HTMLButtonElement>,
    icon?: string,
    loading?: boolean,
    disabled?: boolean,
    validityRef?: boolean | React.RefObject<HTMLElement>
}

function Button(props: ButtonProps) {
    let icon = props.icon;
    let iconClassName = "svg";

    if(props.loading) {
        icon = "spin";
        iconClassName += " spin";
    }

    const {t} = useTranslation("btn");

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
        if(props.loading || e.button !== 0 || props.disabled) {
            return;
        }

        if(props.validityRef !== undefined) {
            if(typeof props.validityRef === "boolean") {
                const parentForm = utils.findParentWithTagName(e.currentTarget, "form");

                if(parentForm) {
                    if(!parentForm.reportValidity()) {
                        return;
                    } 
                } else {
                    console.warn("[Validation] Unable to find a form");
                }
            } else if(props.validityRef.current) {
                if(props.validityRef.current.tagName.toLowerCase() === "form") {
                    if(!(props.validityRef.current as HTMLFormElement).reportValidity()) {
                        return;
                    }
                } else {
                    const formElements = props.validityRef.current.querySelectorAll("input, textarea");

                    for(let i = 0; i < formElements.length; i++) {
                        const input = formElements[i] as HTMLInputElement;

                        if(!input.reportValidity()) {
                            return;
                        }
                    }
                }
            }
        }

        if(props.onClick) {
            props.onClick(e);
        }
    }

    return (
        <button 
            type="button"
            className={props.loading ? "loading" : ""}
            disabled={props.disabled} 
            onClick={handleClick} 
            {...{accent: props.accent}}
        >
            {icon && 
                <img draggable={false} alt="button_icon" src={`/img/${icon}.svg`} className={iconClassName} />
            }
            {t(props.text)}
        </button>
    );
}

export default Button;