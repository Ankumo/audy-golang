const multipleEntries = require("react-app-rewire-multiple-entry")([{
    entry: 'src/login/index.tsx',
    template: 'public/login.html',
    outPath: '/login.html'
}]);

module.exports = {
    webpack: config => {
        multipleEntries.addMultiEntry(config);
        return config;
    }
}