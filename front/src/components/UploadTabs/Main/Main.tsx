import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { UploadTabs } from '../../../lib/enums';
import { selector, useAppDispatch } from '../../../store/hooks';
import { currentSize, queueLoaded, queueSize, uploadActions } from '../../../store/reducers/upload';
import Searchbar from '../../Forms/Searchbar'
import Slider from '../../Forms/Slider';


export interface UploadTabsProps {
    onNeedToSelectFiles: () => void
}

const Main = React.forwardRef<HTMLDivElement, UploadTabsProps>((props, ref) => {
    const curSize = selector(currentSize);
    const queuePrec = selector(state => {
        return Math.floor(queueLoaded(state) / queueSize(state) * 100);
    });
    const ftpuActive = selector(state => state.upload.ftpUploadActive);
    const ftpuPrec = selector(state => state.upload.ftpProcessingList.length / state.upload.ftpUploadPendingFiles * 100);
    const queue = selector(state => state.upload.queue);

    const [sval, setSval] = useState("");

    const dispatch = useAppDispatch();
    const {t, i18n} = useTranslation("upload");

    const handleHttp = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(queue.length > 0) {
            dispatch(uploadActions.setTab(UploadTabs.UPLOAD_HTTP));
        } else {
            props.onNeedToSelectFiles();
        }
    }, [queue.length, props, dispatch]);

    const handleFtp = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(uploadActions.setTab(UploadTabs.UPLOAD_FTP));
    }, [dispatch]);

    return (
        <div className="upload-tab main" ref={ref}>
            <div className="modal-header">
                <Searchbar 
                    placeholder="vk_search"
                    lazy
                    value={sval}
                    onInput={setSval} 
                    onSearch={() => {}}  //TODO
                />
            </div>
            <div className="modal-body">
                <div className={curSize > 0 ? "upload-main-btn upload-active" : "upload-main-btn"} onClick={handleHttp}>
                    <img draggable={false} alt="http_icon" src="/img/file-upload.svg" className="svg" />
                    <span>
                        {curSize > 0 ? queuePrec + "%" : t("http")}
                    </span>
                    {curSize > 0 &&
                        <Slider 
                            disabled 
                            min={0} 
                            max={100} 
                            step={1} 
                            value={queuePrec} 
                            onInput={() => {}} 
                        />
                    }
                </div>
                <span>{i18n.t("or")}</span>
                <div className={ftpuActive ? "upload-main-btn upload-active" : "upload-main-btn"} onClick={handleFtp}>
                    <img draggable={false} alt="ftp_icon" src="/img/database.svg" className="svg" />
                    <span>
                        {ftpuActive ? ftpuPrec + "%" : t("ftp")}
                    </span>
                    {ftpuActive &&
                        <Slider 
                            disabled 
                            min={0} 
                            max={100} 
                            step={1} 
                            value={ftpuPrec} 
                            onInput={() => {}} 
                        />
                    }
                </div>
            </div>
        </div>
    );
});

export default Main;