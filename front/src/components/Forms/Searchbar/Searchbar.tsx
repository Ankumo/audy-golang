import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TKey } from "../../../lib/types";
import { ClassConditioner } from "../../../lib/utils";
import Appear from "../../Helpers/Appear";

interface SearchbarProps {
    value: string,
    onSearch: (val: string) => void,
    lazy?: boolean,
    placeholder?: TKey<"placeholder">,
    timeout?: number,
    onInput: (val: string) => void
}

let timeout = window.setTimeout(() => {}, 1);

function Searchbar(props: SearchbarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const spanRef = useRef<HTMLSpanElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const {t} = useTranslation("placeholder");

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        props.onInput(e.target.value);

        if(!props.lazy) {
            clearTimeout(timeout);

            if(e.target.value.length > 0) {
                timeout = window.setTimeout(props.onSearch, props.timeout ?? 500, e.target.value);
            } else {
                props.onSearch("");
            }
        }
    }

    function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        if(e.button !== 0 || e.target === inputRef.current) {
            return;
        }

        if(inputRef.current) {
            inputRef.current.focus();
        }

        e.preventDefault();
    }

    const classes = new ClassConditioner({
        searchbar: true,
        "has-value": props.value.length > 0,
        lazy: props.lazy ?? false
    });

    const ph = props.placeholder ? t(props.placeholder) : undefined;

    useEffect(() => {
        if(spanRef.current && inputRef.current) {
            const width = getComputedStyle(spanRef.current).width;

            inputRef.current.style.width = width;
            inputRef.current.style.marginLeft = `calc(50% - ${width} / 2)`;
        }
    }, [ph]);

    return (
        <div ref={rootRef} className={classes.computed} onMouseDown={handleMouseDown}>
            <img 
                className={props.lazy ? "svg hover" : "svg"} 
                alt="search_icon" 
                src="/img/search.svg" 
                draggable={false}
                onClick={props.lazy ? () => props.onSearch(props.value) : undefined} 
            />
            <input 
                type="text" 
                value={props.value} 
                ref={inputRef} 
                placeholder={ph} 
                onChange={handleChange} 
            />
            <Appear cond={props.value.length > 0} mounty timeout={{enter: 200}}>
                <img 
                    className="svg search-clear" 
                    alt="cancel_search_btn" 
                    src="/img/times.svg" 
                    onClick={() => {props.onInput(""); props.onSearch("")}} 
                />
            </Appear>
            <span ref={spanRef}>{ph}</span>
        </div>
    );
}

export default Searchbar;