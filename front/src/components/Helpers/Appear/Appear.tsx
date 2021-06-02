import React, { ReactElement, ReactNode, useRef } from "react";
import { CSSTransition } from "react-transition-group";

interface AppearProps {
    timeout?: number | { appear?: number, exit?: number, enter?: number},
    children: ReactNode,
    cond?: boolean,
    classNames?: string,
    nodeRef?: React.RefObject<HTMLElement>,
    mounty?: boolean
}

function Appear(props: AppearProps) {
    const cond = props.cond ?? true;
    let childRef = useRef<HTMLElement>(null);
    const classNames = props.classNames ?? "fade";

    if(props.nodeRef) {
        childRef = props.nodeRef;
    }

    return (
        <CSSTransition 
            timeout={props.timeout ?? 200} 
            mountOnEnter={props.mounty}
            unmountOnExit={props.mounty}
            in={cond} 
            classNames={classNames} 
            nodeRef={childRef}
            appear
        >
            {props.nodeRef ? props.children : React.cloneElement(React.Children.only(props.children) as ReactElement<any>, {
                ref: childRef
            })}
        </CSSTransition>
    );
}

export default Appear;