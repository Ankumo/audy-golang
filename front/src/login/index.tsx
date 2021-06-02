import React from 'react';
import ReactDOM from 'react-dom';
import LoginApp from './LoginApp';
import '../index.css';
import { Provider } from 'react-redux';
import { store } from '../store';

ReactDOM.render(
    <React.StrictMode>
        <Provider store={store}>
            <LoginApp />
        </Provider>
    </React.StrictMode>,
    document.getElementById('root')
);