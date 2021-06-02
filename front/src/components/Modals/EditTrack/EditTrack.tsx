import Dialog from "../Dialog";
import React, { useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";
import Button from "../../Forms/Button";
import Input from "../../Forms/Input";
import { TrackApi } from "../../../lib/api";
import utils from "../../../lib/utils";
import { ModalBase, Track } from "../../../lib/types";

export interface EditTrackProps extends ModalBase {
    track: Track
}

const EditTrack = React.forwardRef<HTMLDivElement, EditTrackProps>(({track, ...props}, ref) => {
    const formRef = useRef<HTMLFormElement>(null);
    const {t} = useTranslation();
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);

    const [formState, setFormState] = useState({
        artist: track.artist,
        title: track.title,
        lyrics: track.lyrics
    });

    function handleCancel(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        dispatch(rootActions.hideModal(props.id));
    }

    function handleSave(e: React.MouseEvent<HTMLElement>) {
        if(e.button !== 0) {
            return;
        }

        const reqPool: Array<Promise<any>> = [];
        
        if(formState.artist !== track.artist || formState.title !== track.title) {
            reqPool.push(TrackApi.update(track.md5, formState.artist, formState.title));
        }

        if(formState.lyrics !== track.lyrics) {
            reqPool.push(TrackApi.setLyrics(track.md5, formState.lyrics));
        }

        if(reqPool.length > 0) {
            setLoading(true);
            Promise.allSettled(reqPool).then(results => {
                let errors = false;

                results.forEach(res => {
                    if(res.status === "rejected") {
                        utils.alertError(res.reason);
                        errors = true;
                    }
                });

                if(!errors) {
                    dispatch(rootActions.hideModal(props.id));
                }

                setLoading(false);
            });
        } else {
            utils.alertText(t("error:no_changes"));
        }
    }

    function handleFormChange(val: string, key: "artist" | "title" | "lyrics") {
        setFormState({...formState, [key]: val});
    }

    return (
        <Dialog 
            ref={ref}  
            header={<h3>{t("track_edit_modal_header", {tname: track.artist + " - " + track.title})}</h3>} 
            footer={
                <>
                    <div onClick={handleCancel}>
                        {t("btn:cancel")}
                    </div>
                    <div>
                        <Button text="save" validityRef={formRef} loading={loading} onClick={handleSave} />
                    </div>
                </>
            }
            {...props}
        >
            <form ref={formRef}>
                <Input 
                    value={formState.artist} 
                    disabled={loading} 
                    placeholder="track_edit_artist"
                    required
                    onInput={val => handleFormChange(val, "artist")} 
                />
                <Input 
                    value={formState.title} 
                    disabled={loading} 
                    required
                    placeholder="track_edit_title"
                    onInput={val => handleFormChange(val, "title")}  
                />
                <Input 
                    value={formState.lyrics} 
                    disabled={loading} 
                    multiline 
                    placeholder="track_edit_lyrics"
                    onInput={val => handleFormChange(val, "lyrics")}  
                />
            </form>
        </Dialog>
    );
});

export default EditTrack;