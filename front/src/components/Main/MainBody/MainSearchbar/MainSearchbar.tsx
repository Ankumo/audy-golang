import { useEffect, useState } from "react";
import { usePrev } from "../../../../lib/hooks";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { rootActions } from "../../../../store/reducers/root";
import Searchbar from "../../../Forms/Searchbar";

interface MainSearchbarProps {

}

function MainSearchbar(props: MainSearchbarProps) {
    const searchString = selector(state => state.root.searchString);
    const dispatch = useAppDispatch();
    let [searchValue, setSearchValue] = useState(searchString);
    const prevSearchString = usePrev(searchString);

    useEffect(() => {
        if(prevSearchString !== searchString) {
            setSearchValue(searchString);
        }
    }, [searchString, prevSearchString]);

    return (
        <Searchbar 
            placeholder="search"
            value={searchValue} 
            onInput={setSearchValue} 
            onSearch={val => dispatch(rootActions.setSearchString(val))} 
        />
    );
}

export default MainSearchbar;