import { ModalBase, UserInTable } from "../../../lib/types";
import Dialog from "../Dialog";
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import Button from "../../Forms/Button";
import Input from "../../Forms/Input";
import Checkbox from "../../Forms/Checkbox";
import { UserApi } from "../../../lib/api";
import { useAppDispatch } from "../../../store/hooks";
import { rootActions } from "../../../store/reducers/root";

interface AddUserProps extends ModalBase {
    callback: (newUser: UserInTable) => void
}

const AddUser = React.forwardRef<HTMLDivElement, AddUserProps>((props, ref) => {
    const [loading, setLoading] = useState(false);
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);

    const {t} = useTranslation();
    const dispatch = useAppDispatch();

    const handleAddBtn = useCallback(async (e: React.MouseEvent<HTMLElement>) => {
        setLoading(true);

        await UserApi.add(login, password, isAdmin).then(newUser => {
            props.callback(newUser);
            dispatch(rootActions.hideModal(props.id));
        }).catch(() => {});
        setLoading(false);
    }, [login, password, isAdmin, props, dispatch]);

    const handleClose = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if(e.button !== 0) {
            return;
        }

        dispatch(rootActions.hideModal(props.id));
    }, [dispatch, props.id]);

    return (
        <Dialog 
            ref={ref} 
            closers={['outside', 'button']}
            header={<h3>{t("add_user_modal_header")}</h3>}
            footer={
                <>
                    <div onClick={handleClose}>{t("btn:cancel")}</div>
                    <div>
                        <Button text="add" validityRef={formRef} loading={loading} onClick={handleAddBtn} />
                    </div>
                </>
            }
            {...props}
        >
            <form ref={formRef}>
                <Input 
                    required 
                    minlength={3}
                    maxlength={20}
                    placeholder="new_user_login" 
                    value={login} 
                    onInput={setLogin} 
                />
                <Input 
                    required 
                    minlength={3}
                    maxlength={20}
                    type="password" 
                    placeholder="new_user_password" 
                    value={password} 
                    onInput={setPassword} 
                />
                <Checkbox checked={isAdmin} label="is_admin" onChange={setIsAdmin} />
            </form>
        </Dialog>
    );
});

export default AddUser;