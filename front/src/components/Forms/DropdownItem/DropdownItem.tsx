import { useTranslation } from "react-i18next";

export interface DropdownItemProps {
    divider?: boolean,
    value?: string | number,
    tns?: string,
    text?: string,
    cond?: boolean | ((...args: any) => boolean),
    onClick: (key: string | number) => void,
    active?: boolean,
    icon?: string
}

function DropdownItem(props: DropdownItemProps) {
    const {i18n} = useTranslation();

    if(props.cond !== undefined) {
        if(typeof props.cond === "function") {
            if(!props.cond()) {
                return null;
            }
        } else if(!props.cond) {
            return null;
        }
    }

    if(props.divider) {
        return <li className="divider"></li>
    }

    return (
        <li className={props.active ? "active" : ""} onClick={() => props.onClick(props.value!)}>
            {props.icon && 
                <img draggable={false} alt="dropdown_icon" src={`/img/${props.icon}.svg`} className="svg" />
            }

            {props.text ?? i18n.t(props.tns ? `${props.tns}:${props.value}` : props.value!.toString())}
        </li>
    );
}

export default DropdownItem;