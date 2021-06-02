import React from 'react';
import Dialog from "../Dialog";
import { useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";
import { ModalBase } from '../../../lib/types';

export interface MessageBoxProps extends ModalBase {
    header?: string,
    body?: string,
    info?: string
}

const MessageBox = React.forwardRef<HTMLDivElement, MessageBoxProps>((props, ref) => {
    const dispatch = useAppDispatch();

    return (
        <Dialog 
            ref={ref} 
            closers={["button", "outside"]}
            header={props.header && <h3>{props.header}</h3>}  
            footer={
                <div onClick={() => dispatch(rootActions.hideModal(props.id))}>
                    OK
                </div>
            }
        >
            {props.body}
            {props.info && props.info.length > 0 && <div className="modal-pre">{props.info}</div>}
        </Dialog>
    );
});

export default MessageBox;