import { UploadTabs } from "../../lib/enums";
import FTP from "./FTP";
import HTTP from "./HTTP";
import Main from "./Main";

const uploadTabs = {
    [UploadTabs.MAIN]: Main,
    [UploadTabs.UPLOAD_HTTP]: HTTP,
    [UploadTabs.UPLOAD_FTP]: FTP
} as const;

export default uploadTabs;