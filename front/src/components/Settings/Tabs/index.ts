import { SettingsTabs } from "../../../lib/enums";
import Account from "./Account";
import Admin from "./Admin";
import Themes from "./Themes";
import Vk from "./Vk";

const tabs = {
    [SettingsTabs.ACCOUNT]: Account,
    [SettingsTabs.THEMES]: Themes,
    [SettingsTabs.VK]: Vk,
    [SettingsTabs.ADMIN]: Admin
} as const;

export default tabs;