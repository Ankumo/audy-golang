import React, {useEffect, useRef} from 'react';

export function usePrev<S>(value: S) {
    const ref = useRef<S>();
    useEffect(() => {
        ref.current = value;
    });

    return ref.current;
}

export function useComponentDidMount(action: React.EffectCallback) {
    /* eslint-disable */
    useEffect(action, []);
}

export function useCloseableWidthAdjustment(props: {naked?: boolean}, ref: React.RefObject<HTMLElement>) {
    useEffect(() => {
        if(!props.naked && ref.current) {
            const ul = ref.current.querySelector("ul");

            if(ul) {
                ref.current.style.width = ul.offsetWidth + "px";
            }
        }
    }, [props.naked]);
}

export function useModalRef(ref: React.LegacyRef<HTMLDivElement>) {
    return ref as React.RefObject<HTMLElement>;
}