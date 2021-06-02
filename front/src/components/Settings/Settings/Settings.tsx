import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsTabs } from "../../../lib/enums";
import utils from "../../../lib/utils";
import { selector, useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";
import KeyTransition from "../../Helpers/KeyTransition";
import tabs from "../Tabs";

interface SettingsProps {

}

const adminTabs = [
    SettingsTabs.ADMIN,
    SettingsTabs.VK
];

function Settings(props: SettingsProps) {
    const opened = selector(state => state.root.settingsOpened);
    const tabsList = selector(state => state.user.is_admin ? utils.getEnumValues(SettingsTabs) :
        utils.getEnumValues(SettingsTabs).filter(t => !adminTabs.includes(t)));

    const [tab, setTab] = useState(SettingsTabs.ACCOUNT); 
    const dispatch = useAppDispatch();
    const {i18n} = useTranslation();

    const handleCloseSettings = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(rootActions.setSettingsOpened(false));
    }, [dispatch]);

    const handleChooseTab = useCallback((e: React.MouseEvent<HTMLElement>, t: SettingsTabs) => {
        if(e.button !== 0) {
            return;
        }

        setTab(t);
    }, []);

    const Tab = tabs[tab];

    return (
        <div className={opened ? "settings opened" : "settings"}>
            <div className="close">
                <img 
                    className="svg hover" 
                    alt="close_icon" 
                    src="/img/times.svg" 
                    draggable={false}
                    onClick={handleCloseSettings} 
                />
            </div>
            <ul className="sidebar">
                {tabsList.map(t => (
                    <li className={t === tab ? "active" : ""} key={t} onClick={e => handleChooseTab(e, t)}>
                        {i18n.t("settingsTabs:" + t)}
                    </li>
                ))}
            </ul>
            <KeyTransition tkey={tab.toString()} classNames="from-bottom">
                <div className="main">
                    <h1>{i18n.t("settingsTabs:" + tab)}</h1>
                    <Tab />
                </div>
            </KeyTransition>
        </div>
    );
}

export default Settings;