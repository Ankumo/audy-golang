import React, { useRef, ReactElement } from "react";
import { CSSTransition, SwitchTransition } from "react-transition-group";

interface KeyTransitionProps {
    children: React.ReactNode,
    mode?: "out-in" | "in-out",
    tkey: string,
    timeout?: number | { appear?: number; enter?: number; exit?: number },
    nodeRef?: React.RefObject<HTMLElement>,
    classNames?: string
}

function KeyTransition(props: KeyTransitionProps) {
    let childRef = useRef<HTMLElement>(null);

    if(props.nodeRef) {
        childRef = props.nodeRef;
    }

    return (
        <SwitchTransition mode={props.mode}>
            <CSSTransition 
                nodeRef={childRef} 
                key={props.tkey} 
                timeout={props.timeout || 200} 
                classNames={props.classNames || "fade"}
            >
                {props.nodeRef ? props.children : React.cloneElement(React.Children.only(props.children) as ReactElement<any>, {
                    ref: childRef
                })}
            </CSSTransition>
        </SwitchTransition>
    );
}

export default KeyTransition;