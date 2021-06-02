import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserApi } from "../../../../lib/api";
import { DropdownAction } from "../../../../lib/types";
import utils from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { createModal, rootActions } from "../../../../store/reducers/root";
import { userActions } from "../../../../store/reducers/user";
import Checkbox from "../../../Forms/Checkbox";
import EditableHeader from "../../../Forms/EditableHeader";
import Input from "../../../Forms/Input";
import Select from "../../../Forms/Select";
import SettingsBlock from "../../SettingsBlock";

interface AccountProps {

}

function Account(props: AccountProps) {
    const dummy = selector(state => state.root.updateDummy);
    const nickname = selector(state => state.user.nickname);
    const autoplay = selector(state => state.user.autoplay);
    const rem_ip = selector(state => state.user.rem_ip);
    const lang = selector(state => state.user.lang);
    const has_avatar = selector(state => state.user.has_avatar);

    const [nicknameState, setNicknameState] = useState(nickname);
    const [oldPass, setOldPass] = useState("");
    const [newPass, setNewPass] = useState("");
    const [nicknameChanging, setNicknameChanging] = useState(false);
    const [autoplayState, setAutoplayState] = useState(autoplay);
    const [remipState, setRemipState] = useState(rem_ip);
    const [langState, setLangState] = useState(lang);

    const {t, i18n} = useTranslation();
    const dispatch = useAppDispatch();

    const handleSetAvatar = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        utils.fileDialog({
            multiple: false,
            exts: ["image/*"]
        }).then(files => {
            dispatch(createModal("AvatarCrop", {
                image: files[0],
                async callback(cropped, modalId) {
                    if(cropped === null) {
                        return;
                    }

                    return UserApi.changeAvatar(cropped).then(() => {
                        utils.alertInfo(t("avatar_changed_successfully"));
                        dispatch(rootActions.updateDummies());
                        dispatch(rootActions.hideModal(modalId));
                    }).catch(() => {});
                }
            }));
        });
    }, [dispatch, t]);

    const handleRemoveAvatar = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        utils.confirmT("confirm_remove_avatar", {}, () => {
            return UserApi.removeAvatar().then(() => {
                utils.alertInfo(t("avatar_removed_successfully"));
                dispatch(rootActions.updateDummies());
            }).catch(() => {});
        });
    }, [dispatch, t]);

    const handleChangePassword = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        return UserApi.changePassword(oldPass, newPass).then(() => {
            utils.alertInfo(t("password_changed_successfully"));

            setOldPass("");
            setNewPass("");
        }).catch(() => {});
    }, [oldPass, newPass, t]);

    const handleSavePreferences = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        const prefs = {
            lang: langState,
            autoplay: autoplayState,
            rem_ip: remipState
        };

        return UserApi.update(langState, remipState, autoplayState).then(() => {
            dispatch(userActions.updatePrefs(prefs));
            if(prefs.lang !== i18n.language) {
                i18n.changeLanguage(prefs.lang);
            }
            utils.alertInfo(t("preferences_updated"));
        }).catch(() => {});
    }, [langState, remipState, autoplayState, dispatch, t, i18n]);

    const handleNicknameChanged = useCallback(async (val: string) => {
        setNicknameChanging(true);
        await UserApi.changeNickname(val).then(() => {
            setNicknameState(val);
            dispatch(userActions.updateNickname(val));
        }).catch(() => {
            setNicknameState(nickname);
        });
        setNicknameChanging(false);
    }, [dispatch, nickname]);

    const langs: DropdownAction[] = [];

    for(let k in i18n.options.resources) {
        const res = i18n.options.resources[k] as any;

        langs.push({
            value: k,
            text: res["default"]["lang_desc"]
        });
    }

    const prefSaveDisabled = langState === lang && remipState === rem_ip && autoplay === autoplayState;

    return (
        <div className="account">
            <SettingsBlock for="account_details" btnText="remove_avatar" btnDisabled={has_avatar} btnClick={handleRemoveAvatar}>
                <div className="details-wrapper">
                    <div 
                        className="avatar"  
                        style={{backgroundImage: `url(${utils.apiProxy("avatar", "?dummy=" + dummy)})`}} 
                        onClick={handleSetAvatar} 
                    />
                    <EditableHeader 
                        readonly={nicknameChanging} 
                        value={nicknameState} 
                        placeholder="nickname"
                        maxlength={20}
                        onInput={setNicknameState} 
                        onChange={handleNicknameChanged}   
                    />
                </div>
            </SettingsBlock>

            <SettingsBlock for="change_password" btnText="change_password" btnClick={handleChangePassword} btnValidate>
                <>
                    <Input 
                        type="password" 
                        required
                        minlength={3}
                        maxlength={20}
                        placeholder="old_password" 
                        value={oldPass} 
                        onInput={setOldPass} 
                    />
                    <Input 
                        type="password" 
                        required
                        minlength={3}
                        maxlength={20}
                        placeholder="new_password" 
                        value={newPass} 
                        onInput={setNewPass} 
                    />
                </>
            </SettingsBlock>

            <SettingsBlock 
                for="preferences" 
                btnText="save"
                btnClick={handleSavePreferences}
                btnDisabled={prefSaveDisabled}
            >
                <>
                    <span className="with-dropdown">
                        {t("preferences_language")}:
                        <Select options={langs} value={langState} onChange={val => setLangState(val as string)} />
                    </span>
                    <Checkbox label="autoplay" checked={autoplayState} onChange={setAutoplayState} />
                    <Checkbox label="log_ip" checked={remipState} onChange={setRemipState} />
                </>
            </SettingsBlock>
        </div>
    );
}

export default Account;