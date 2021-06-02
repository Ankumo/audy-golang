import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { FileState, UploadTabs } from '../../../lib/enums';
import { UploadFile } from '../../../lib/types';
import { selector, useAppDispatch } from '../../../store/hooks';
import { currentSize, uploadActions } from '../../../store/reducers/upload';
import { dequeueHttp } from '../../../store/thunks';
import NoItems from '../../Helpers/NoItems';
import { UploadTabsProps } from '../Main';

function statusData(f: UploadFile) {
    switch(f.state) {
        case FileState.QUEUE:
            return {
                title: i18n.t("upload:status_queue"),
                imgSrc: "/img/queued.svg",
                imgClass: "svg warning"
            };
        case FileState.DONE:
            return {
                title: i18n.t("upload:status_success"),
                imgSrc: "/img/check-circle.svg",
                imgClass: "svg success"
            };
        case FileState.ACTIVE:
            return {
                title: i18n.t("upload:status_active"),
                imgSrc: "/img/spin.svg",
                imgClass: "svg spin"
            };
        case FileState.ERROR:
            return {
                title: i18n.t(`error:${f.err?.key}`),
                imgSrc: "/img/error.svg",
                imgClass: "svg error"
            };
        default: 
            return {
                title: i18n.t("upload:status_warning"),
                imgSrc: "/img/warning.svg",
                imgClass: "svg warning"
            };
    }
}

const HTTP = React.forwardRef<HTMLDivElement, UploadTabsProps>((props, ref) => {
    const queue = selector(state => [...state.upload.queue].sort((a, b) => {
        return a.state === FileState.ACTIVE || (a.state === FileState.QUEUE && b.state !== FileState.ACTIVE) ? -1 : 1;
    }));
    
    const currentFile = selector(state => state.upload.currentFile);
    const currentPrec = selector(state => Math.floor(state.upload.loadedCurrent / currentSize(state) * 100));

    const {t} = useTranslation("upload");
    const dispatch = useAppDispatch();

    const handleCancelBtn = useCallback((e: React.MouseEvent<HTMLElement>, id: string) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(dequeueHttp(id));
    }, [dispatch]);

    const handleBack = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(uploadActions.setTab(UploadTabs.MAIN));
    }, [dispatch]);

    return (
        <div className="upload-tab http" ref={ref}>
            <div className="modal-header">
                <h3>{t("tab_header_http")}</h3>
            </div>
            <div className="modal-body">
                {queue.length > 0 &&
                    <table cellPadding={0} cellSpacing={0}>
                        <thead>
                            <tr>
                                <th></th>
                                <th style={{width: "500px"}}>{t("table_header_name")}</th>
                                <th style={{width: "100px"}}>{t("table_header_size")}</th>
                                <th style={{width: "50px"}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(f => {
                                const data = statusData(f);

                                return (
                                    <tr 
                                        key={f.id} 
                                        title={data.title} 
                                        className={currentFile === f.id ? "active" : ""} 
                                        style={currentFile === f.id ? {backgroundSize: `${currentPrec}% auto`} : {}}
                                    >
                                        <td>
                                            <img alt="status_icon" src={data.imgSrc} className={data.imgClass} />
                                        </td>
                                        <td className="file-name">
                                            {f.file.name}
                                        </td>
                                        <td>
                                            {t("table_file_size", {size: (f.file.size / 1024 / 1024).toFixed(1)})}
                                        </td>
                                        <td className="cancel-btn">
                                            <div>
                                                <img 
                                                    src="/img/times.svg" 
                                                    alt="cancel_btn_icon" 
                                                    className="svg hover" 
                                                    onClick={e => handleCancelBtn(e, f.id)} 
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                }

                {queue.length === 0 && 
                    <NoItems text={t("table_no_rows")} />
                }
            </div>
            <div className="modal-footer">
                <div onClick={handleBack}>
                    {i18n.t("btn:back")}
                </div>
                <div onClick={props.onNeedToSelectFiles}>
                    {i18n.t("btn:add_more_files")}
                </div>
            </div>
        </div>
    );
});

export default HTTP;