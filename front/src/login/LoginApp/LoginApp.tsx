import { useCallback, useRef, useState } from "react";
import Button from "../../components/Forms/Button";
import Input from "../../components/Forms/Input";
import AlertsContainer from "../../components/Helpers/AlertsContainer";
import { UserApi } from "../../lib/api";
import { selector } from "../../store/hooks";

interface LoginAppProps {

}

function LoginApp(props: LoginAppProps) {
    const alerts = selector(state => state.root.alerts);

    const formRef = useRef<HTMLFormElement>(null);

    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = useCallback(async () => {
        setLoading(true);
        await UserApi.login(login, password).then(() => {
            window.location.reload();
        }).catch(() => {});
        setLoading(false);
    }, [login, password]);

    return (
        <div className="login-form">
            <form ref={formRef}>
                <Input 
                    required
                    minlength={3}
                    maxlength={20}
                    value={login}
                    placeholder="username"
                    onInput={setLogin}
                />
                <Input 
                    required
                    type="password"
                    minlength={3}
                    maxlength={20}
                    value={password}
                    placeholder="password"
                    onInput={setPassword}
                />
                <Button 
                    text="login" 
                    accent="secondary" 
                    loading={loading}
                    validityRef={formRef} 
                    onClick={handleLogin} 
                />
            </form>
            <AlertsContainer alertsProvider={alerts} />
        </div>
    );
}

export default LoginApp;