import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TKey } from "../../../lib/types";
import Button from "../../Forms/Button";

interface SettingsBlockProps {
    children?: JSX.Element,
    btnClick?: (e: React.MouseEvent<HTMLElement>) => Promise<void>,
    btnText?: TKey<"btn">,
    for: TKey<"settingsBlock">,
    btnDisabled?: boolean,
    btnValidate?: boolean
}

function SettingsBlock(props: SettingsBlockProps) {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);

    const {t} = useTranslation("settingsBlock");

    const handleBtnClick = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0 || !props.btnClick) {
            return;
        }

        setLoading(true);
        await props.btnClick(e);
        setLoading(false);
    }, [props]);

    return (
        <div className={"settings-block " + props.for}>
            <h2>{t(props.for)}</h2>
            <div className="block-body" ref={bodyRef}>
                {props.children}
            </div>
            {props.btnClick && 
                <Button 
                    loading={loading} 
                    accent="primary" 
                    validityRef={props.btnValidate ? bodyRef : undefined}
                    text={props.btnText!} 
                    disabled={props.btnDisabled}
                    onClick={handleBtnClick} 
                />
            }
        </div>
    );
}

export default SettingsBlock;