import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DropdownAction, WindowState } from "../../../lib/types";
import utils, { ClassConditioner, eventBus } from "../../../lib/utils";
import DropdownItem, { DropdownItemProps } from "../DropdownItem";

type ContextMenuAction<T> = DropdownAction & {
    withMultiple?: boolean,
    contextCond?: (item: T, el: HTMLElement) => boolean
}

interface ContextMenuProps<T> {
    actions: ContextMenuAction<T>[],
    noScroll?: boolean,
    onAction?: (val: string | number, item: T, el: HTMLElement) => void,
    tns?: string,
    nodeRef: React.RefObject<HTMLElement>,
    multiple?: boolean,
    setRef: (el: HTMLElement) => T | null
}

interface ContextMenuState<T> {
    item: T | null,
    el: HTMLElement | null,
    opened: boolean,
    x: number, 
    y: number,
    rev: boolean
}

const contextMenuOffset = 4;

function ContextMenu<T = any>(props: ContextMenuProps<T>) {
    const rootRef = useRef<HTMLDivElement>(null);

    const [contextState, setContextState] = useState<ContextMenuState<T>>({
        opened: false,
        item: null,
        el: null,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        rev: false
    });
    
    const handleClose = useCallback(() => {
        if(contextState.opened) {
            if(contextState.el !== null && contextState.el.classList.contains("context-active")) {
                contextState.el.classList.remove("context-active");
            }

            setContextState({
                ...contextState,
                opened: false,
                el: null,
                item: null
            });
        }
    }, [contextState]);

    const handleActionClick = useCallback((v: string | number) => {
        if(props.onAction && contextState.el && contextState.item) {
            props.onAction(v, contextState.item, contextState.el);
        }

        handleClose();
    }, [contextState, handleClose, props]);

    const handleContextMenu = useCallback(function(/*this: HTMLElement, */e: MouseEvent) {
        if(process.env.NODE_ENV === "development" && e.shiftKey) {
            return;
        }

        e.preventDefault();
    }, []);

    useEffect(() => {
        if(!props.nodeRef.current) {
            return;
        }

        function handleOpen(e: MouseEvent) {
            if(e.button === 2 && props.nodeRef.current) {
                if(process.env.NODE_ENV === "development" && e.shiftKey) {
                    return;
                }

                if(contextState.el !== null && contextState.el.classList.contains("context-active")) {
                    contextState.el.classList.remove("context-active");
                }

                const parent = utils.getParent(e.target as HTMLElement, props.nodeRef.current);

                if(parent !== null && rootRef.current) {
                    const item = props.setRef(parent);

                    if(!item) {
                        return;
                    }

                    if(!parent.classList.contains("context-active")) {
                        parent.classList.add("context-active");
                    }

                    setContextState({
                        opened: true,
                        el: parent,
                        item,
                        x: e.clientX,
                        y: e.clientY,
                        rev: false
                    });
                }
            }
        }

        function onResize(e: CustomEvent<{o: WindowState, n: WindowState}>) {
            if(contextState.opened) {
                const {o, n} = e.detail;

                const xDiff = n.innerWidth - o.innerWidth;
                let yDiff = n.innerHeight - o.innerHeight;

                if(xDiff !== 0 || yDiff !== 0) {
                    const bounds = rootRef.current?.getBoundingClientRect();
                    yDiff = 0;

                    if((bounds && bounds.bottom > n.innerHeight - 86) || contextState.rev) {
                        yDiff = 0.01;
                    }

                    setContextState({
                        ...contextState,
                        x: contextState.x + xDiff,
                        y: contextState.y + yDiff
                    });
                }
            }
        }

        const node = props.nodeRef.current;

        node.addEventListener("contextmenu", handleContextMenu);
        node.addEventListener("mouseup", handleOpen);
        eventBus.on("ddclose", handleClose);
        eventBus.on("windowResize", onResize as EventListener);

        return () => {
            node.removeEventListener("contextmenu", handleContextMenu);
            node.removeEventListener("mouseup", handleOpen);
            eventBus.unsub("ddclose", handleClose);
            eventBus.unsub("windowResize", onResize as EventListener);
        }
    }, [props, handleClose, contextState, handleContextMenu]);

    useLayoutEffect(() => {
        if(!rootRef.current) {
            return;
        }

        let x = contextState.x + contextMenuOffset;
        let y = contextState.y + contextMenuOffset;
        let rev = false;

        if(y + rootRef.current.offsetHeight > window.innerHeight - 86) {
            y -= rootRef.current.offsetHeight;
            rev = true;

            if(y + rootRef.current.offsetHeight > window.innerHeight - 86) {
                handleClose();
                return;
            }
        }

        if(x + rootRef.current.offsetWidth > window.innerWidth) {
            x -= rootRef.current.offsetWidth + contextMenuOffset * 2;
        }

        rootRef.current.style.left = x + "px";
        rootRef.current.style.top = y + "px";

        if(rev !== contextState.rev) {
            setContextState({...contextState, rev});
        }
    }, [contextState, handleClose]);

    const classes = new ClassConditioner({
        "context-menu": true,
        closeable: true,
        "no-scroll": props.noScroll ?? false,
        opened: contextState.opened,
        rev: contextState.rev
    });

    return (
        <div 
            className={classes.computed} 
            style={{left: contextState.x + "px", top: contextState.y + "px"}} 
            ref={rootRef}
            onContextMenu={e => handleContextMenu(e.nativeEvent)}
        >
            {contextState.el && contextState.item &&
                <ul>
                    {props.actions.map((a, index) => {
                        const actionProps: DropdownItemProps = {
                            ...a,
                            onClick: handleActionClick,
                            tns: props.tns
                        };

                        if(a.contextCond) {
                            actionProps.cond = a.contextCond(contextState.item!, contextState.el!);
                        }

                        if(props.multiple && !a.withMultiple) {
                            actionProps.cond = false;
                        }

                        return <DropdownItem key={a.value || `__undefined_index_${index}__`} {...actionProps} />;
                    })}
                </ul>
            }
        </div>
    );
}

export default ContextMenu;