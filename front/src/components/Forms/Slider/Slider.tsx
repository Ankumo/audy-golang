import React, { useEffect, useRef } from "react";
import { ClassConditioner } from "../../../lib/utils";

interface SliderProps {
    min: number,
    max: number,
    step: number,
    vertical?: boolean,
    thumb?: boolean,
    value: number,
    onChange?: (val: number) => void,
    onInput: (val: number) => void
    disabled?: boolean
}

let dragging = false;
let bounds: DOMRect;

function Slider(props: SliderProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const steps = Math.ceil((props.max - props.min) / props.step);
    const currentStep = Math.round((props.value - props.min) / props.step);

    let val = props.value;

    let prec = currentStep / steps * 100;

    if(props.value >= props.max) {
        prec = 100;
        val = props.max;
    }

    if(props.value <= props.min) {
        prec = 0;
        val = props.min;
    }

    let prevValue = val;

    let thumbStyle: React.CSSProperties = {};
    let progressStyle: React.CSSProperties = {};

    if(props.vertical) {
        if(props.thumb) {
            thumbStyle = {
                bottom: prec + "%"
            };
        }

        progressStyle = {
            height: prec + "%"
        };
    } else {
        if(props.thumb) {
            thumbStyle = {
                left: prec + "%"
            };
        }

        progressStyle = {
            width: prec + "%"
        };
    }

    function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        if(e.button !== 0 || props.disabled) {
            return;
        }

        if(props.thumb) {
            const target = e.target as HTMLElement;

            if(target.classList.contains("thumb")) {
                dragging = true;
                prevValue = val;
                classes.update();
            }
        } else {
            dragging = true;
            prevValue = val;
            classes.update();
        }
    }

    function calcMouseValue(clientPos: number) {
        let bound = 0;

        if(props.vertical) {
            bound = Math.round(bounds.bottom - clientPos) / bounds.height * 100;
        } else {
            bound = Math.round(clientPos - bounds.left) / bounds.width * 100;
        }

        const stepAtPos = Math.round(steps * bound / 100);
        let newValue = stepAtPos * props.step + props.min;

        if(newValue < props.min) {
            newValue = props.min;
        }

        if(newValue > props.max) {
            newValue = props.max;
        }

        if(newValue !== val) {
            val = newValue;

            props.onInput(val);
        }
    }

    function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
        if(e.button !== 0 || props.disabled) {
            return;
        }

        if(props.thumb) {
            if(!dragging) {
                calcMouseValue(props.vertical ? e.clientY : e.clientX);
            }
        } else {
            calcMouseValue(props.vertical ? e.clientY : e.clientX);
        }
    }

    useEffect(() => {
        const handleMouseMove = props.vertical ? (e: MouseEvent) => {
            if(!rootRef.current) {
                return;
            }

            bounds = rootRef.current.getBoundingClientRect();
            if(dragging && e.clientY >= bounds.top && e.clientY <= bounds.bottom) {
                calcMouseValue(e.clientY);
            }
        } : (e: MouseEvent) => {
            if(!rootRef.current) {
                return;
            }

            bounds = rootRef.current.getBoundingClientRect();
            if(dragging && e.clientX >= bounds.left && e.clientX <= bounds.right) {
                calcMouseValue(e.clientX);
            }
        };
        
        function handleWindowMouseUp(e: MouseEvent) {
            if(e.button !== 0 || props.disabled) {
                return;
            }

            if(dragging) {
                dragging = false;
                classes.update();
    
                if(prevValue !== props.value && props.onChange) {
                    props.onChange(props.value);
                }
            }
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleWindowMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleWindowMouseUp);
        }
    });

    const classes = new ClassConditioner({
        slider: true,
        vertical: props.vertical ?? false,
        dragging: () => dragging
    }, rootRef);

    return (
        <div className={classes.computed} ref={rootRef} onMouseUp={handleMouseUp} onMouseDown={handleMouseDown}>
            {props.thumb && <div className="thumb" style={thumbStyle}></div>}
            <div className="progress" style={progressStyle}></div>
        </div>
    );
}

export default Slider;