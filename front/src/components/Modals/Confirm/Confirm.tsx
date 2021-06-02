import React, { useState } from 'react'
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../lib/types';
import { useAppDispatch } from '../../../store/hooks';
import { rootActions } from '../../../store/reducers/root';
import Button from '../../Forms/Button';
import Dialog from '../Dialog';

export interface ConfirmProps extends ModalBase {
    header?: string,
    text?: string,
    callback?: () => Promise<any>,
    noCallback?: () => void
}

const Confirm = React.forwardRef<HTMLDivElement, ConfirmProps>((props, ref) => {
    const {t} = useTranslation();
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);

    function handleNo(e: React.MouseEvent<HTMLElement>) {
        if(loading || e.button !== 0) {
            return;
        }

        dispatch(rootActions.hideModal(props.id));
        if(props.noCallback) {
            props.noCallback();
        }
    }

    async function handleYes(e: React.MouseEvent<HTMLButtonElement>) {
        if(e.button !== 0) {
            return;
        }

        if(props.callback) {
            setLoading(true);

            try {
                await props.callback();
            } catch {
                return;
            } finally {
                setLoading(false);
            }
        }

        dispatch(rootActions.hideModal(props.id));
    }

    return (
        <Dialog 
            closers={[]} 
            className={loading ? "loading" : ""} 
            ref={ref} 
            header={props.header && <h3>{props.header}</h3>} 
            footer={
                <>
                    <div onClick={handleNo}>
                        {t("btn:no")}
                    </div>
                    <div>
                        <Button loading={loading} text="yes" onClick={handleYes} />
                    </div>
                </>
            }
        >
            {props.text}
        </Dialog>
    );
});

export default Confirm;