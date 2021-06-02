import React from 'react';
import { useTranslation } from 'react-i18next';
import { useComponentDidMount } from '../../../lib/hooks';
import utils from '../../../lib/utils';
import { useAppDispatch } from '../../../store/hooks';
import { rootActions } from '../../../store/reducers/root';

export interface AlertProps {
    text?: string,
    timeout?: number,
    tkey?: string,
    info?: string,
    infoHeader?: string,
    id?: string,
    accent?: "error" | "warning" | "info"
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>((props, ref) => {
    const {i18n, t} = useTranslation();
    const dispatch = useAppDispatch();

    function handleMoreInfoClick(e: React.MouseEvent<HTMLElement>) {
        if(!props.info) {
            return;
        }

        utils.messageBox(props.tkey ? i18n.t(props.tkey) : props.text ?? "", props.infoHeader ?? i18n.t("msgh:default"), props.info);
    }

    useComponentDidMount(() => {
        setTimeout(() => {
            dispatch(rootActions.closeAlert(props.id));
        }, props.timeout ?? 1000 * 10);
    });

    return (
        <div ref={ref} className={props.accent ? "alert " + props.accent : "alert"}>
            <span>
                {props.tkey !== undefined ? i18n.t(props.tkey) : props.text}
                {props.info && <> <label onClick={handleMoreInfoClick}>{t("alert_more_info")}</label></>}
            </span>
            
            <img 
                alt="close_icon" 
                src="/img/times.svg" 
                className="svg hover" 
                onClick={() => dispatch(rootActions.closeAlert(props.id))} 
            />
        </div>
    );
});

export default Alert;