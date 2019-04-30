export default function (config, env, helpers) {
    // console.log(config.plugins)
    // find old
    const oldPlugin = helpers.getPluginsByName(config, 'UglifyJsPlugin')[0];
    if (oldPlugin) {
        // remove the old
        const { index } = oldPlugin
        config.plugins.splice(index, 1);
    }
}
