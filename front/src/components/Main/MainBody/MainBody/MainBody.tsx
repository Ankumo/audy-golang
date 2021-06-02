import { selector } from "../../../../store/hooks";
import { AlertProps } from "../../../Helpers/Alert";
import AlertsContainer from "../../../Helpers/AlertsContainer";
import MainHeader from "../MainHeader";
import MainSearchbar from "../MainSearchbar";
import Tracklist from "../Tracklist";
import TracklistActions from "../TracklistActions";

interface MainBodyProps {
    alerts: AlertProps[]
}

function MainBody(props: MainBodyProps) {
    const hasModal = selector(state => state.root.modals.length > 0);

    return (
        <div className="main">
            <div className={hasModal ? "main-wrapper has-modal" : "main-wrapper"}>
                <MainSearchbar />
                <MainHeader />
                <TracklistActions />
                <Tracklist />
                <AlertsContainer alertsProvider={props.alerts} />
            </div>
        </div>
    );
}

export default MainBody;