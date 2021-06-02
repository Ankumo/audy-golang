import React from "react";
import { TKey } from "../../../lib/types";
import Button from "../../Forms/Button";

interface NoItemsProps {
    header?: string,
    icon?: string,
    text?: string,
    btnText?: TKey<"btn">,
    btnClick?: (e: React.MouseEvent<HTMLElement>) => void,
    btnLoading?: boolean,
    iconSpin?: boolean
}

const NoItems = React.forwardRef<HTMLDivElement, NoItemsProps>((props, ref) => {
    return (
        <div ref={ref} className="no-items">
            {props.header && <h1>{props.header}</h1>}
            {props.icon && 
                <img 
                    alt="no_items_icon" 
                    src={`/img/${props.icon}.svg`} 
                    className={props.iconSpin ? "svg spin" : "svg"}
                />
            }
            {props.text && <span>{props.text}</span>}
            {props.btnText && <Button text={props.btnText} loading={props.btnLoading} onClick={props.btnClick} />}
        </div>
    );
});

export default NoItems;