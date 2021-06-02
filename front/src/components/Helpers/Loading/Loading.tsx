import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { LoadingState } from "../../../lib/enums";
import sse from "../../../lib/sse";
import Button from "../../Forms/Button";
import KeyTransition from "../KeyTransition";
import React from 'react'
import Appear from "../Appear";
import Api from "../../../lib/api";
import AlertsContainer from "../AlertsContainer";
import { AlertProps } from "../Alert";

interface LoadingProps {
    appState: LoadingState
    alerts: AlertProps[]
}

const reconnectTimeout = 5;

function Loading(props: LoadingProps) {
    const [counter, setCounter] = useState(reconnectTimeout);
    const [loading, setLoading] = useState(false);
    const interval = useRef<number | null>(null);

    const {t} = useTranslation("init");

    let content: JSX.Element | null = <h1>{t("loading")}</h1>;

    const handleReconnect = useCallback(() => {
        if(interval.current) {
            clearInterval(interval.current);
            interval.current = null;
        }

        sse.init();
    }, []);

    const handleAllTabsDisconnect = useCallback(async () => {
        setLoading(true);
        await Api.closech().then(() => {
            sse.init();
        }).catch(() => {});
        setLoading(false);
    }, []);

    useEffect(() => {
        if(props.appState === LoadingState.LOADING) {
            setCounter(reconnectTimeout);
        }
    }, [props.appState]);

    switch(props.appState) {
        case LoadingState.ALREADY_CONNECTED:
            content = (
                <>
                    <h1>{t("already_connected")}</h1>
                    <span>{t("already_connected_desc")}</span>
                    <Button text="switch_tab" loading={loading} accent="secondary" onClick={handleAllTabsDisconnect} />
                </>
            );
            break;
        case LoadingState.ERROR:
            content = (
                <>
                    <h1>{t("error")}</h1>
                    <span>{t("error_desc")}</span>
                    <Trans parent="span" i18nKey="init:reconnect_counter" values={{counter}} />
                    <Button text="reconnect_now" accent="secondary" onClick={handleReconnect} />
                </>
            );

            if(interval.current === null) {
                interval.current = window.setInterval(() => {
                    let real = counter;
                    setCounter(counter => {
                        return real = counter - 1;
                    });
                    
                    if(real <= 0) {
                        handleReconnect();
                    }
                }, 1000);
            }
            break;
        case LoadingState.DESTROYED: 
            content = (
                <>
                    <h1>{t("destroyed")}</h1>
                    <span>{t("destroyed_desc")}</span>
                </>
            );
            break;
        case LoadingState.READY:
            content = null;
            break;
    }

    return (
        <Appear mounty timeout={{appear: 1500, exit: 500}} cond={props.appState !== LoadingState.READY}>
            <div className="loading">
                <KeyTransition tkey={props.appState.toString()}>
                    <div className="loading-wrapper">
                        {content}
                    </div>
                </KeyTransition>
                <AlertsContainer alertsProvider={props.alerts} />
            </div>
        </Appear>
    );
}

export default Loading;