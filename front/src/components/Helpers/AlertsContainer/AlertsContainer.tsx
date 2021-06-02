import { createRef } from 'react';
import {TransitionGroup, CSSTransition} from 'react-transition-group';
import Alert, { AlertProps } from '../Alert';

interface AlertsContainerProps {
    alertsProvider: AlertProps[]
}

function AlertsContainer(props: AlertsContainerProps) {
    return (
        <TransitionGroup className="alerts-container">
            {props.alertsProvider.map(a => {
                const alertRef = createRef<HTMLDivElement>();

                return (
                    <CSSTransition key={a.id} timeout={200} classNames="alert" nodeRef={alertRef}>
                        <Alert key={a.id} {...a} ref={alertRef} />
                    </CSSTransition>
                );
            })}
        </TransitionGroup>
    );
}

export default AlertsContainer;