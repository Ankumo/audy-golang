import React, { createRef } from 'react';
import './App.css';
import { LoadingState } from './lib/enums';
import { selector } from './store/hooks';
import Sidebar from './components/Main/Sidebar';
import MainBody from './components/Main/MainBody/MainBody';
import Loading from './components/Helpers/Loading';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import Settings from './components/Settings/Settings';
import MusicBar from './components/MusicBar/MusicBar';
import Modals from './components/Modals';

function App() {  
    const appState = selector(state => state.root.appState);
    const bgUrl = selector(state => state.root.bgUrl);
    const modals = selector(state => state.root.modals);
    const alerts = selector(state => state.root.alerts);

    const bgDefault = bgUrl === "/img/default_album.png";

    return (
        <>
            <Loading appState={appState} alerts={alerts} />
            {appState === LoadingState.READY && 
                <>
                    <div className="app-wrapper">
                        <Sidebar />
                        <MainBody alerts={alerts} />
                        <MusicBar />
                        <Settings />
                    </div>
                    <div 
                        className={bgDefault ? 'album-background default' : 'album-background'} 
                        style={{backgroundImage: `url(${bgUrl})`}} 
                    />
                    <TransitionGroup className="modals">
                        {modals.map(m => {
                            const Modal = Modals[m.component];
                            const itemRef = createRef<HTMLDivElement>();
                            const props = {...m.props, ref: itemRef} as any;

                            return (
                                <CSSTransition key={m.props.id} classNames="fade" timeout={200} nodeRef={itemRef}>
                                    <Modal {...props} />
                                </CSSTransition>
                            );
                        })}
                    </TransitionGroup>
                    <input type="color" className="global-color-picker" />
                </>
            }
        </>
    );
}

export default App;
