import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Api, { UserApi } from "../../../../lib/api";
import { UserTableActions } from "../../../../lib/enums";
import { useComponentDidMount } from "../../../../lib/hooks";
import { AppLanguages, DropdownAction, UserInTable } from "../../../../lib/types";
import utils from "../../../../lib/utils";
import { selector, useAppDispatch } from "../../../../store/hooks";
import { createModal, rootActions } from "../../../../store/reducers/root";
import Button from "../../../Forms/Button";
import Checkbox from "../../../Forms/Checkbox";
import ContextMenu from "../../../Forms/ContextMenu";
import Input from "../../../Forms/Input";
import Select from "../../../Forms/Select";
import KeyTransition from "../../../Helpers/KeyTransition";
import NoItems from "../../../Helpers/NoItems";
import SettingsBlock from "../../SettingsBlock";

interface AdminProps {

}

function Admin(props: AdminProps) {
    const serverData = selector(state => state.root.serverData);
    const currentUserId = selector(state => state.user.id);
    const isRoot = selector(state => state.user.is_root);

    const [isFetching, setIsFetching] = useState(false);
    const [sessionTime, setSessionTime] = useState(serverData.vars.session_time);
    const [customAppTitle, setCustomAppTitle] = useState(serverData.vars.custom_app_title);
    const [defaultLanguage, setDefaultLanguage] = useState<AppLanguages>(serverData.vars.default_language as AppLanguages);

    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const noItemsRef = useRef<HTMLDivElement>(null);
    const {t, i18n} = useTranslation();
    const dispatch = useAppDispatch();

    const fetchServerData = useCallback(async () => {
        if(isFetching) {
            return;
        }

        setIsFetching(true);
        await Api.serverData().then(data => {
            data.fetched = true;
            dispatch(rootActions.setServerData(data));

            setCustomAppTitle(data.vars.custom_app_title);
            setSessionTime(data.vars.session_time);
            setDefaultLanguage(data.vars.default_language as AppLanguages);
        }).catch(() => {});
        setIsFetching(false);
    }, [dispatch, isFetching]);

    const handleAddUser = useCallback((e: React.MouseEvent<HTMLElement>) => {
        dispatch(createModal("AddUser", {
            callback(newUser) {
                dispatch(rootActions.appendUser(newUser));
            }
        }));
    }, [dispatch]);

    const handleUserAction = useCallback((action: UserTableActions, item: UserInTable) => {
        switch(action) {
            case UserTableActions.RESET_PASSWORD:
                utils.confirmT("confirm_reset_password", {user: item.nickname}, () => {
                    return UserApi.resetPassword(item.id).then(({newPassword}) => {
                        utils.messageBoxT("password_resetted", { newPassword, user: item.nickname });
                    }).catch(() => {});
                });
                break;
            case UserTableActions.DELETE:
                utils.confirmT("confirm_remove_user", {user: item.nickname}, () => {
                    return UserApi.remove(item.id).then(() => {
                        dispatch(rootActions.removeUser(item.id));
                        utils.alertInfo(t("user_removed", {nickname: item.nickname}))
                    }).catch(() => {});
                });
                break;
            case UserTableActions.UNSET_ADMIN:
            case UserTableActions.SET_ADMIN:
                utils.confirmT(action === UserTableActions.SET_ADMIN ? "confirm_unset_admin" : "confirm_set_admin", {
                    user: item.nickname
                }, () => {
                    return UserApi.setAdmin(item.id, action === UserTableActions.SET_ADMIN).then(() => {
                        dispatch(rootActions.setUserAdmin({
                            id: item.id,
                            state: action === UserTableActions.SET_ADMIN
                        }));
                        utils.alertInfo(t(action === UserTableActions.SET_ADMIN ? "user_admin_setted" : "user_admin_unsetted", {nickname: item.nickname}));
                    }).catch(() => {});
                });
                break;
        }
    }, [t, dispatch]);

    const handleSaveVars = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const vars = {defaultLanguage, sessionTime, customAppTitle};
        return Api.setServerData(defaultLanguage, sessionTime, customAppTitle).then(() => {
            utils.alertInfo(t("server_data_changed"));
            dispatch(rootActions.setServerData({...serverData, vars: {
                default_language: vars.defaultLanguage,
                custom_app_title: vars.customAppTitle,
                session_time: vars.sessionTime
            }}));
            dispatch(rootActions.setAppTitle(vars.customAppTitle));
        }).catch(() => {});
    }, [customAppTitle, sessionTime, defaultLanguage, t, dispatch, serverData]);

    const handleSessionTimeInput = useCallback((val: string) => {
        let num = parseInt(val);

        if (Number.isNaN(num)) {
            num = 0;
        }

        setSessionTime(num);
    }, []);

    useComponentDidMount(() => {
        if(!serverData.fetched) {
            fetchServerData();
        }
    });

    const langs: DropdownAction[] = [];

    for(let k in i18n.options.resources) {
        const res = i18n.options.resources[k] as any;

        langs.push({
            value: k,
            text: res["default"]["lang_desc"]
        });
    }

    const svSaveDisabled = serverData.vars.custom_app_title === customAppTitle &&
        serverData.vars.default_language === defaultLanguage && serverData.vars.session_time === sessionTime;

    return (
        <div className="admin">
            {!serverData.fetched &&
                <div className="settings-block">
                    <KeyTransition tkey={isFetching.toString()} nodeRef={noItemsRef}>
                        {isFetching ?
                            <NoItems 
                                icon="spin"
                                iconSpin
                                ref={noItemsRef}
                                text={t("server_data_fetching")}
                            /> :
                            <NoItems 
                                icon="times"
                                btnClick={fetchServerData}
                                btnText="try_again"
                                ref={noItemsRef}
                                text={t("unable_to_fetch_server_data")}
                            />
                        }
                    </KeyTransition>
                </div>
            }
            {serverData.fetched &&
                <>
                    <SettingsBlock for="users">
                        <>
                            <Button text="add_user" accent="primary" icon="addpl" onClick={handleAddUser} />
                            <table cellPadding={0} cellSpacing={0}>
                                <tbody ref={tbodyRef}> 
                                    {serverData.users.map((u, index) => (
                                        <tr key={u.id} className={currentUserId === u.id ? "active" : ""} {...{"data-id": u.id}}>
                                            <td>
                                                {index + 1}
                                            </td>
                                            <td>
                                                {u.nickname}
                                            </td>
                                            <td>
                                                <Checkbox disabled checked={u.is_admin} label="is_admin" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <ContextMenu<UserInTable>
                                nodeRef={tbodyRef}
                                tns="userTableActions"
                                noScroll
                                actions={[
                                    {
                                        contextCond: item => isRoot && !item.is_admin,
                                        value: UserTableActions.SET_ADMIN
                                    },
                                    {
                                        contextCond: item => isRoot && item.is_admin,
                                        value: UserTableActions.UNSET_ADMIN
                                    },
                                    {
                                        value: UserTableActions.RESET_PASSWORD
                                    },
                                    {divider:true},
                                    {
                                        value: UserTableActions.DELETE
                                    }
                                ]}
                                setRef={el => {
                                    const id = el.getAttribute("data-id");

                                    if(id) {
                                        return serverData.users.find(u => u.id.toString() === id) ?? null;
                                    }

                                    return null;
                                }}
                                onAction={(action, item) => handleUserAction(action as number, item)}
                            />    
                        </>
                    </SettingsBlock>

                    <SettingsBlock for="server_vars" btnText="save" btnClick={handleSaveVars} btnDisabled={svSaveDisabled}>
                        <>
                            <Input 
                                placeholder="session_time" 
                                value={sessionTime.toString()} 
                                type="number" 
                                onInput={handleSessionTimeInput} 
                            />
                            <Input placeholder="custom_app_title" value={customAppTitle} onInput={setCustomAppTitle} />
                            <span className="with-dropdown">
                                {t("placeholder:default_language")}: 
                                <Select  
                                    value={defaultLanguage}
                                    options={langs}
                                    onChange={val => setDefaultLanguage(val as AppLanguages)}
                                />
                            </span>
                        </>
                    </SettingsBlock>

                    <SettingsBlock for="utilities">
                        <>
                            <span>{t("wipe_utility")}</span>
                            <Button text="wipe_db" accent="secondary" />
                        </>
                    </SettingsBlock>
                </>
            }
            
        </div>
    );
}

export default Admin;