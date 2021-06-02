import React from "react";
import Modal, { ModalProps } from "../Modal";

const Dialog = React.forwardRef<HTMLDivElement, ModalProps>((props, ref) => {
    return (
        <Modal ref={ref} {...props} />
    );
});

export default Dialog;