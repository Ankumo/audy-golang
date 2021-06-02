import React, { RefObject, useCallback, useEffect, useState } from 'react';
import { ModalBase, UploadFile } from "../../../lib/types";
import { FileState, UploadTabs } from "../../../lib/enums";
import KeyTransition from "../../Helpers/KeyTransition";
import { selector, useAppDispatch } from "../../../store/hooks";
import uploadTabs from "../../UploadTabs";
import { uploadActions } from "../../../store/reducers/upload";
import { useTranslation } from "react-i18next";
import { rootActions } from "../../../store/reducers/root";
import { startHttp } from "../../../store/thunks";
import utils from '../../../lib/utils';
import axios from 'axios';

interface UploadProps extends ModalBase {

}

const cancellationEvents = ["dragenter", "dragleave", "drop", "dragover"];
function cancellationEvent(e: Event) {
    e.preventDefault();
}

const Upload = React.forwardRef<HTMLDivElement, UploadProps>((props, ref) => {  
    const tab = selector(state => state.upload.tab);
    const [filesDragged, setFilesDragged] = useState(false);
    const [hldz, setHldz] = useState(false);

    const {t} = useTranslation("upload");
    const dispatch = useAppDispatch();

    const Tab = uploadTabs[tab];

    function handleModalClick(e: React.MouseEvent<HTMLElement>) {
        if((ref as RefObject<HTMLDivElement>).current?.firstChild?.contains(e.target as any)) {
            return;
        }

        dispatch(rootActions.hideModal(props.id));
    }

    const handleFilesChosen = useCallback((files: File[]) => {
        const checkedFiles: UploadFile[] = [];

        for(const file of files) {
            if(file.name.endsWith(".mp3")) {
                checkedFiles.push({
                    file,
                    id: file.name + file.size + file.lastModified,
                    state: FileState.QUEUE,
                    uploadId: -1,
                    ct: axios.CancelToken.source()
                });
            }
        }

        if(checkedFiles.length > 0) {
            if(tab !== UploadTabs.UPLOAD_HTTP) {
                dispatch(uploadActions.setTab(UploadTabs.UPLOAD_HTTP));
            }
            
            dispatch(startHttp(checkedFiles));
        }
    }, [dispatch, tab]);

    const handleModalDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
        if(e.relatedTarget === null) {
            setFilesDragged(false);
        }
    }, []);

    const handleWrapperDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
        if(e.relatedTarget !== null && (e.target as HTMLDivElement).contains(e.relatedTarget as any)) {
            return;
        }

        setHldz(false);
    }, []);

    const handleWrapperDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
        setHldz(false);
        setFilesDragged(false);

        handleFilesChosen(Array.from(e.dataTransfer.files));
    }, [handleFilesChosen]);

    const handleNeedToSelectFiles = useCallback(() => {
        utils.fileDialog({
            multiple: true,
            exts: [".mp3"]
        }).then(files => {
            handleFilesChosen(Array.from(files));
        }).catch(() => {});
    }, [handleFilesChosen]);

    useEffect(() => {
        function windowBlur() {
            setHldz(false);
            setFilesDragged(false);
        }

        for(const e of cancellationEvents) {
            window.addEventListener(e, cancellationEvent, true);
        }

        window.addEventListener("blur", windowBlur);

        return () => {
            for(const e of cancellationEvents) {
                window.removeEventListener(e, cancellationEvent, true);
            }

            window.removeEventListener("blur", windowBlur);
        }
    }, []);

    return (
        <div 
            className="modal-upload" 
            ref={ref} 
            onClick={handleModalClick} 
            onDrop={() => setFilesDragged(false)}
            onDragEnter={() => setFilesDragged(true)}
            onDragLeave={handleModalDragLeave}
        >
            <div 
                className="modal-wrapper" 
                onDragEnter={() => setHldz(true)}
                onDragLeave={handleWrapperDragLeave}
                onDrop={handleWrapperDrop}
            >
                <KeyTransition tkey={tab.toString()}>
                    <Tab onNeedToSelectFiles={handleNeedToSelectFiles} />
                </KeyTransition>

                {filesDragged && 
                    <div className={"upload-dropzone" + (hldz ? " highlighted" : "")}>
                        <img alt="upload_icon" src="/img/upload-drop.svg" className="svg" />
                        <span>{t("dropzone_desc")}</span>
                    </div>
                }
            </div>
        </div>
    );
});

export default Upload;