import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { store } from './store';
import { Provider } from 'react-redux';
import * as serviceWorker from './serviceWorker';
import './i18n';
import utils, { eventBus } from './lib/utils';
import sse from './lib/sse';
import { WindowState } from './lib/types';
import { userActions } from './store/reducers/user';

window.player = document.createElement("audio");

document.defaultTheme = utils.grabDefaultStyles();
const writeableStyle = document.createElement("style");
document.head.appendChild(writeableStyle);

for(let i = document.styleSheets.length; i >= 0; i--) {
    try {
        if(document.styleSheets[i].ownerNode === writeableStyle) {
            document.writeableSheet = document.styleSheets[i];
            break;
        }
    } catch {
        continue;
    }
}

document.addEventListener("click", e => {
    const dropdowns = document.querySelectorAll("div.closeable.opened");

    if(dropdowns.length > 0) {  
        for(let i = 0; i < dropdowns.length; i++) {
            if(e && dropdowns[i].contains(e.target as HTMLElement)) {
                continue;
            }
            
            eventBus.emit("ddclose", {detail: e});
            break;
        }
    }
}, true);

let oldWindowState: WindowState = {
    e: new Event("resize"),
    innerHeight: window.innerHeight,
    outerHeight: window.outerHeight,
    innerWidth: window.innerWidth,
    outerWidth: window.outerWidth
};

window.addEventListener("resize", e => {
    const newWindowState: WindowState = {
        e,
        innerHeight: window.innerHeight,
        outerHeight: window.outerHeight,
        innerWidth: window.innerWidth,
        outerWidth: window.outerWidth
    };

    eventBus.emit<{o: WindowState, n: WindowState}>("windowResize", {
        detail: {
            o: oldWindowState,
            n: newWindowState
        }
    });

    oldWindowState = newWindowState;
});

window.addEventListener("keypress", e => {
    if(e.ctrlKey && e.shiftKey && e.code.toLowerCase() === "keyz") {
        store.dispatch(userActions.setTheme(""));
    }
});

sse.init();

ReactDOM.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>,
    document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
