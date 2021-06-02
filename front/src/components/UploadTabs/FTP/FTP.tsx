import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { TrackApi } from '../../../lib/api';
import { UploadTabs } from '../../../lib/enums';
import utils from '../../../lib/utils';
import { selector, useAppDispatch } from '../../../store/hooks';
import { uploadActions } from '../../../store/reducers/upload';
import Button from '../../Forms/Button';
import NoItems from '../../Helpers/NoItems';
import { UploadTabsProps } from '../Main';

const FTP = React.forwardRef<HTMLDivElement, UploadTabsProps>((props, ref) => {
    const ftpUploadActive = selector(state => state.upload.ftpUploadActive);
    const ftpProcessingList = selector(state => state.upload.ftpProcessingList);
    const pendingFiles = selector(state => state.upload.ftpUploadPendingFiles);
    const [loading, setLoading] = useState(false);

    const {t, i18n} = useTranslation("upload");
    const dispatch = useAppDispatch();

    const placeholderRows: Array<JSX.Element> = [];

    for(let i = 0; i < pendingFiles - ftpProcessingList.length; i++) {
        placeholderRows.push(<tr><td>-</td><td>-</td></tr>);
    }

    const handleStart = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        setLoading(true);
        await TrackApi.reqFtpUpload().catch(() => {});
        setLoading(false);
    }, []);

    const handleBack = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(uploadActions.setTab(UploadTabs.MAIN));
    }, [dispatch]);

    return (
        <div className="upload-tab ftp" ref={ref}>
            <div className="modal-header">
                <h3>{t("tab_header_ftp")}</h3>
            </div>
            <div className="modal-body">
                {ftpUploadActive &&
                    <span>
                        {t("ftp_pending_files", {count: pendingFiles})}
                    </span>
                }
                {ftpProcessingList.length > 0 &&
                    <table>
                        <tbody>
                            {ftpProcessingList.map(f => (
                                <tr 
                                    key={f.fileName} 
                                    title={f.success ? t("ftp_file_status_success") : t("ftp_file_status_error", {err: i18n.t("error:" + f.key)})}
                                >
                                    <td>
                                        <img 
                                            alt="status_icon" 
                                            src={`/img/${f.success ? "check-circle" : "error"}.svg`}
                                            className={`svg ${f.success ? "success" : "error"}`} 
                                        />
                                    </td>
                                    <td className="file-name">{f.fileName}</td>
                                </tr>
                            ))}
                            {placeholderRows}
                        </tbody>
                    </table>
                }
                {ftpProcessingList.length === 0 &&
                    <NoItems 
                        header={t("ftp_no_items_header")} 
                        btnText="ftp_upload_help"
                        btnClick={() => utils.messageBoxT("ftp_upload_help")} 
                    />
                }
            </div>
            <div className="modal-footer">
                <div onClick={handleBack}>
                    {i18n.t("btn:back")}
                </div>
                <div>
                    <Button loading={loading} text="start_ftp_upload" onClick={handleStart} />
                </div>
            </div>
        </div>
    );
});

export default FTP;