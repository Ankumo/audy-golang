import React from "react";
import { ModalBase } from "../../../lib/types";
import { useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";

export interface ModalProps extends ModalBase {
    closers?: ("outside" | "button")[],
    header?: React.ReactNode,
    children?: React.ReactNode,
    footer?: React.ReactNode,
    className?: string
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>((props, ref) => {
    const dispatch = useAppDispatch();
    const closers = props.closers ?? ["outside"];
    const nRef = ref as React.RefObject<HTMLDivElement>;
    const className = props.className !== undefined ? "modal " + props.className : "modal";

    function close(type: "outside" | "button", e?: React.MouseEvent<HTMLDivElement>) {
        if(e && e.button !== 0) {
            return;
        }
        
        if(~closers.indexOf(type)) {
            if(type === "outside" && nRef?.current && e?.target !== nRef.current) {
                return;
            }

            dispatch(rootActions.hideModal());
        }
    }

    return (
        <div className={className} ref={ref} onMouseDown={e => close("outside", e)}>
            <div className="modal-wrapper">
                {props.header && 
                    <div className="modal-header">
                        {props.header}
                        {closers.indexOf("button") >= 0 && 
                            <img className="svg hover" alt="close_icon" src="/img/times.svg" onClick={e => close("button", e)} />
                        }
                    </div>
                }
                {props.children && 
                    <div className="modal-body">
                        {props.children}
                    </div>
                }
                {props.footer && 
                    <div className="modal-footer">
                        {props.footer}
                    </div>
                }
            </div>
        </div> 
    );
});

export default Modal;