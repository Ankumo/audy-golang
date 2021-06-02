import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AppState, AppDispatch } from '.';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const selector: TypedUseSelectorHook<AppState> = useSelector;

export function useDummy() {
    return selector(state => state.root.updateDummy);
}

export function useSearchString() {
    return selector(state => state.root.searchString);
}